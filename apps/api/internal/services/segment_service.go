package services

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/repositories"
)

// Segment-related service errors.
var (
	ErrSegmentNotFound  = errors.New("segment not found")
	ErrInvalidRuleField = errors.New("invalid segment field")
	ErrInvalidRuleOp    = errors.New("invalid segment operator")
)

// Whitelisted segment fields and operators (validated server-side).
var allowedSegmentFields = map[string]bool{
	"name": true, "phone": true, "email": true,
	"location": true, "company": true,
	"channel": true, "tag": true,
}

var allowedSegmentOps = map[string]bool{
	"equals":   true,
	"contains": true,
}

// SegmentService implements segment CRUD and member evaluation.
type SegmentService struct {
	pool     *pgxpool.Pool
	segments *repositories.SegmentRepository
	contacts *repositories.ContactRepository
}

// NewSegmentService constructs a SegmentService.
func NewSegmentService(
	pool *pgxpool.Pool,
	segments *repositories.SegmentRepository,
	contacts *repositories.ContactRepository,
) *SegmentService {
	return &SegmentService{pool: pool, segments: segments, contacts: contacts}
}

// CreateSegmentInput is the payload for creating a segment.
type CreateSegmentInput struct {
	WorkspaceID string
	ActorID     string
	Name        string
	Description *string
	Color       string
	Rules       []SegmentRuleInput
}

// SegmentRuleInput is one rule on a new segment.
type SegmentRuleInput struct {
	Field    string
	Operator string
	Value    string
}

// Create inserts a segment together with its rules.
func (s *SegmentService) Create(ctx context.Context, in CreateSegmentInput) (*models.SegmentWithRules, error) {
	for _, r := range in.Rules {
		if !allowedSegmentFields[r.Field] {
			return nil, ErrInvalidRuleField
		}
		if !allowedSegmentOps[r.Operator] {
			return nil, ErrInvalidRuleOp
		}
	}
	color := in.Color
	if color == "" {
		color = "#71717a"
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	actor := in.ActorID
	seg, err := s.segments.WithTx(tx).Create(ctx, repositories.CreateSegmentParams{
		WorkspaceID: in.WorkspaceID,
		Name:        strings.TrimSpace(in.Name),
		Description: trimPtr(in.Description),
		Color:       color,
		CreatedBy:   &actor,
	})
	if err != nil {
		return nil, err
	}

	rules := make([]models.SegmentRule, 0, len(in.Rules))
	for _, r := range in.Rules {
		rule, err := s.segments.WithTx(tx).AddRule(ctx, seg.ID, r.Field, r.Operator, r.Value)
		if err != nil {
			return nil, err
		}
		rules = append(rules, *rule)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	members, _ := s.evaluate(ctx, seg.WorkspaceID, rules)
	return &models.SegmentWithRules{
		Segment:     *seg,
		Rules:       rules,
		MemberCount: len(members),
	}, nil
}

// List returns segments with rule count for the workspace.
func (s *SegmentService) List(ctx context.Context, workspaceID string) ([]models.SegmentWithRules, error) {
	segs, err := s.segments.ListByWorkspace(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	out := make([]models.SegmentWithRules, 0, len(segs))
	for _, seg := range segs {
		rules, err := s.segments.ListRules(ctx, seg.ID)
		if err != nil {
			return nil, err
		}
		members, _ := s.evaluate(ctx, seg.WorkspaceID, rules)
		out = append(out, models.SegmentWithRules{
			Segment:     seg,
			Rules:       rules,
			MemberCount: len(members),
		})
	}
	return out, nil
}

// Get returns one segment with its rules and members.
func (s *SegmentService) Get(ctx context.Context, segmentID string) (*models.SegmentWithRules, []models.Contact, error) {
	seg, err := s.segments.GetByID(ctx, segmentID)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return nil, nil, ErrSegmentNotFound
		}
		return nil, nil, err
	}
	rules, err := s.segments.ListRules(ctx, segmentID)
	if err != nil {
		return nil, nil, err
	}
	members, err := s.evaluate(ctx, seg.WorkspaceID, rules)
	if err != nil {
		return nil, nil, err
	}
	return &models.SegmentWithRules{
		Segment:     *seg,
		Rules:       rules,
		MemberCount: len(members),
	}, members, nil
}

// Delete removes a segment (cascades to rules).
func (s *SegmentService) Delete(ctx context.Context, segmentID, workspaceID string) error {
	return s.segments.Delete(ctx, segmentID, workspaceID)
}

// evaluate filters workspace contacts by the rules (AND-combined).
//
// Memory-resident evaluation keeps Part 4's scope tight; with larger
// catalogs this becomes a single dynamic SQL or a materialised view.
func (s *SegmentService) evaluate(ctx context.Context, workspaceID string, rules []models.SegmentRule) ([]models.Contact, error) {
	all, err := s.contacts.ListByWorkspace(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	if len(rules) == 0 {
		return all, nil
	}

	// Pre-fetch tags per contact only if any rule needs them.
	tagsByContact := map[string]map[string]bool{}
	tagRuleNeeded := false
	for _, r := range rules {
		if r.Field == "tag" {
			tagRuleNeeded = true
			break
		}
	}
	if tagRuleNeeded {
		for _, c := range all {
			tags, err := s.contacts.ListTags(ctx, c.ID)
			if err != nil {
				return nil, err
			}
			set := map[string]bool{}
			for _, t := range tags {
				set[t.ID] = true
			}
			tagsByContact[c.ID] = set
		}
	}

	out := make([]models.Contact, 0, len(all))
	for _, c := range all {
		matched := true
		for _, r := range rules {
			if !ruleMatches(c, r, tagsByContact[c.ID]) {
				matched = false
				break
			}
		}
		if matched {
			out = append(out, c)
		}
	}
	return out, nil
}

func ruleMatches(c models.Contact, r models.SegmentRule, contactTags map[string]bool) bool {
	value := strings.ToLower(strings.TrimSpace(r.Value))
	switch r.Field {
	case "name":
		return matchText(c.Name, value, r.Operator)
	case "phone":
		return matchText(deref(c.Phone), value, r.Operator)
	case "email":
		return matchText(deref(c.Email), value, r.Operator)
	case "location":
		return matchText(deref(c.Location), value, r.Operator)
	case "company":
		return matchText(deref(c.Company), value, r.Operator)
	case "channel":
		if c.ExternalSource == nil {
			return false
		}
		return string(*c.ExternalSource) == value
	case "tag":
		return contactTags != nil && contactTags[r.Value]
	}
	return false
}

func matchText(field, value, op string) bool {
	field = strings.ToLower(field)
	switch op {
	case "equals":
		return field == value
	case "contains":
		return value != "" && strings.Contains(field, value)
	}
	return false
}
