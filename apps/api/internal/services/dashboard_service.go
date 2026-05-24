package services

import (
	"context"
	"math"
	"time"

	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/repositories"
)

// DashboardOverview is the payload backing the dashboard landing page.
type DashboardOverview struct {
	TotalContacts        int                  `json:"total_contacts"`
	NewContacts          int                  `json:"new_contacts"`
	TotalConversations   int                  `json:"total_conversations"`
	OpenConversations    int                  `json:"open_conversations"`
	PendingConversations int                  `json:"pending_conversations"`
	ResolvedToday        int                  `json:"resolved_today"`
	ActiveAgents         int                  `json:"active_agents"`
	ConnectedChannels    int                  `json:"connected_channels"`
	AvgResponseSeconds   int                  `json:"avg_response_seconds"`
	TotalMessages        int                  `json:"total_messages"`
	InboundMessages      int                  `json:"inbound_messages"`
	OutboundMessages     int                  `json:"outbound_messages"`
	ResolutionRate       float64              `json:"resolution_rate"`
	MessagesDelta        float64              `json:"messages_delta"`
	ConversationsDelta   float64              `json:"conversations_delta"`
	ContactsDelta        float64              `json:"contacts_delta"`
	MessagesSeries       []MessagePoint       `json:"messages_series"`
	ChannelBreakdown     []ChannelBreakdown   `json:"channel_breakdown"`
	StatusBreakdown      []StatusBreakdown    `json:"status_breakdown"`
	ResponseSeries       []ResponsePoint      `json:"response_series"`
	HourlyActivity       []HourlyPoint        `json:"hourly_activity"`
	RecentConversations []RecentConversation `json:"recent_conversations"`
}

// MessagePoint is one day of inbound/outbound message volume.
type MessagePoint struct {
	Label    string `json:"label"`
	Inbound  int    `json:"inbound"`
	Outbound int    `json:"outbound"`
}

// ChannelBreakdown is one slice of the channel distribution chart.
type ChannelBreakdown struct {
	Channel string `json:"channel"`
	Value   int    `json:"value"`
}

// StatusBreakdown is one conversation status bucket.
type StatusBreakdown struct {
	Status string `json:"status"`
	Value  int    `json:"value"`
}

// ResponsePoint is average first-response time for a day.
type ResponsePoint struct {
	Label   string `json:"label"`
	Seconds int    `json:"seconds"`
}

// HourlyPoint is message volume grouped by hour of day.
type HourlyPoint struct {
	Hour  string `json:"hour"`
	Total int    `json:"total"`
}

// RecentConversation is the dashboard list projection.
type RecentConversation struct {
	ID            string     `json:"id"`
	ContactName   string     `json:"contact_name"`
	ChannelType   string     `json:"channel_type"`
	ChannelName   string     `json:"channel_name"`
	Preview       *string    `json:"preview"`
	Status        string     `json:"status"`
	UnreadCount   int        `json:"unread_count"`
	LastMessageAt *time.Time `json:"last_message_at"`
}

// DashboardService aggregates metrics for the dashboard overview.
type DashboardService struct {
	db       repositories.DBTX
	members  *repositories.WorkspaceMemberRepository
	channels *repositories.ChannelRepository
}

// NewDashboardService constructs a DashboardService.
func NewDashboardService(
	db repositories.DBTX,
	members *repositories.WorkspaceMemberRepository,
	channels *repositories.ChannelRepository,
) *DashboardService {
	return &DashboardService{db: db, members: members, channels: channels}
}

// Overview returns aggregated metrics for the given workspace.
func (s *DashboardService) Overview(ctx context.Context, workspaceID string, days int) (*DashboardOverview, error) {
	if days <= 0 {
		days = 7
	}
	if days > 90 {
		days = 90
	}
	now := time.Now()
	periodStart := now.AddDate(0, 0, -days+1).Truncate(24 * time.Hour)
	previousStart := periodStart.AddDate(0, 0, -days)

	agents, err := s.members.Count(ctx, workspaceID)
	if err != nil {
		return nil, err
	}

	channels, err := s.channels.ListByWorkspace(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	connected := 0
	for _, ch := range channels {
		if ch.Status == models.StatusConnected {
			connected++
		}
	}

	overview := &DashboardOverview{
		ActiveAgents:      agents,
		ConnectedChannels: connected,
	}

	if err := s.loadTotals(ctx, workspaceID, periodStart, previousStart, now, overview); err != nil {
		return nil, err
	}
	if overview.MessagesSeries, err = s.messageSeries(ctx, workspaceID, periodStart, days); err != nil {
		return nil, err
	}
	if overview.ChannelBreakdown, err = s.channelBreakdown(ctx, workspaceID, periodStart); err != nil {
		return nil, err
	}
	if overview.StatusBreakdown, err = s.statusBreakdown(ctx, workspaceID); err != nil {
		return nil, err
	}
	if overview.ResponseSeries, err = s.responseSeries(ctx, workspaceID, periodStart, days); err != nil {
		return nil, err
	}
	if overview.HourlyActivity, err = s.hourlyActivity(ctx, workspaceID, periodStart); err != nil {
		return nil, err
	}
	if overview.RecentConversations, err = s.recentConversations(ctx, workspaceID); err != nil {
		return nil, err
	}
	return overview, nil
}

func (s *DashboardService) loadTotals(ctx context.Context, workspaceID string, start, previousStart, now time.Time, o *DashboardOverview) error {
	const q = `
		SELECT
			(SELECT count(*) FROM contacts WHERE workspace_id = $1),
			(SELECT count(*) FROM contacts WHERE workspace_id = $1 AND created_at >= $2),
			(SELECT count(*) FROM contacts WHERE workspace_id = $1 AND created_at >= $3 AND created_at < $2),
			(SELECT count(*) FROM conversations WHERE workspace_id = $1),
			(SELECT count(*) FROM conversations WHERE workspace_id = $1 AND created_at >= $2),
			(SELECT count(*) FROM conversations WHERE workspace_id = $1 AND created_at >= $3 AND created_at < $2),
			(SELECT count(*) FROM conversations WHERE workspace_id = $1 AND status = 'open'),
			(SELECT count(*) FROM conversations WHERE workspace_id = $1 AND status = 'pending'),
			(SELECT count(*) FROM conversations WHERE workspace_id = $1 AND status = 'resolved' AND updated_at >= date_trunc('day', $4::timestamptz)),
			(SELECT count(*) FROM conversations WHERE workspace_id = $1 AND status = 'resolved' AND updated_at >= $2),
			(SELECT count(*) FROM conversations WHERE workspace_id = $1 AND status <> 'spam' AND created_at >= $2),
			(SELECT count(*) FROM messages WHERE workspace_id = $1 AND created_at >= $2),
			(SELECT count(*) FROM messages WHERE workspace_id = $1 AND created_at >= $3 AND created_at < $2),
			(SELECT count(*) FROM messages WHERE workspace_id = $1 AND direction = 'inbound' AND created_at >= $2),
			(SELECT count(*) FROM messages WHERE workspace_id = $1 AND direction = 'outbound' AND created_at >= $2),
			COALESCE((
				SELECT avg(extract(epoch from (first_reply.created_at - inbound.created_at)))
				FROM messages inbound
				JOIN LATERAL (
					SELECT created_at
					FROM messages outbound
					WHERE outbound.conversation_id = inbound.conversation_id
					  AND outbound.direction = 'outbound'
					  AND outbound.created_at > inbound.created_at
					ORDER BY outbound.created_at ASC
					LIMIT 1
				) first_reply ON true
				WHERE inbound.workspace_id = $1
				  AND inbound.direction = 'inbound'
				  AND inbound.created_at >= $2
			), 0)`
	var prevContacts, periodConversations, prevConversations, resolvedPeriod, nonSpamPeriod, prevMessages int
	var avgResponse float64
	if err := s.db.QueryRow(ctx, q, workspaceID, start, previousStart, now).Scan(
		&o.TotalContacts, &o.NewContacts, &prevContacts,
		&o.TotalConversations, &periodConversations, &prevConversations,
		&o.OpenConversations, &o.PendingConversations, &o.ResolvedToday,
		&resolvedPeriod, &nonSpamPeriod, &o.TotalMessages, &prevMessages,
		&o.InboundMessages, &o.OutboundMessages, &avgResponse,
	); err != nil {
		return err
	}
	o.AvgResponseSeconds = int(math.Round(avgResponse))
	o.ContactsDelta = percentDelta(o.NewContacts, prevContacts)
	o.ConversationsDelta = percentDelta(periodConversations, prevConversations)
	o.MessagesDelta = percentDelta(o.TotalMessages, prevMessages)
	if nonSpamPeriod > 0 {
		o.ResolutionRate = math.Round((float64(resolvedPeriod)/float64(nonSpamPeriod))*1000) / 10
	}
	return nil
}

func (s *DashboardService) messageSeries(ctx context.Context, workspaceID string, start time.Time, days int) ([]MessagePoint, error) {
	const q = `
		SELECT to_char(day, 'Dy') AS label,
		       count(*) FILTER (WHERE m.direction = 'inbound')::int AS inbound,
		       count(*) FILTER (WHERE m.direction = 'outbound')::int AS outbound
		FROM generate_series($2::date, ($2::date + (($3 - 1) * interval '1 day')), interval '1 day') day
		LEFT JOIN messages m ON m.workspace_id = $1 AND m.created_at >= day AND m.created_at < day + interval '1 day'
		GROUP BY day
		ORDER BY day`
	rows, err := s.db.Query(ctx, q, workspaceID, start, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []MessagePoint{}
	for rows.Next() {
		var p MessagePoint
		if err := rows.Scan(&p.Label, &p.Inbound, &p.Outbound); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *DashboardService) channelBreakdown(ctx context.Context, workspaceID string, start time.Time) ([]ChannelBreakdown, error) {
	const q = `
		SELECT initcap(ch.type::text) AS channel, count(c.id)::int AS value
		FROM channels ch
		LEFT JOIN conversations c ON c.channel_id = ch.id AND c.created_at >= $2
		WHERE ch.workspace_id = $1
		GROUP BY ch.type
		ORDER BY value DESC, channel ASC`
	rows, err := s.db.Query(ctx, q, workspaceID, start)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []ChannelBreakdown{}
	for rows.Next() {
		var b ChannelBreakdown
		if err := rows.Scan(&b.Channel, &b.Value); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

func (s *DashboardService) statusBreakdown(ctx context.Context, workspaceID string) ([]StatusBreakdown, error) {
	const q = `
		SELECT status::text, count(*)::int
		FROM conversations
		WHERE workspace_id = $1
		GROUP BY status
		ORDER BY count(*) DESC`
	rows, err := s.db.Query(ctx, q, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []StatusBreakdown{}
	for rows.Next() {
		var b StatusBreakdown
		if err := rows.Scan(&b.Status, &b.Value); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

func (s *DashboardService) responseSeries(ctx context.Context, workspaceID string, start time.Time, days int) ([]ResponsePoint, error) {
	const q = `
		WITH replies AS (
			SELECT date_trunc('day', inbound.created_at) AS day,
			       extract(epoch from (first_reply.created_at - inbound.created_at)) AS seconds
			FROM messages inbound
			JOIN LATERAL (
				SELECT created_at
				FROM messages outbound
				WHERE outbound.conversation_id = inbound.conversation_id
				  AND outbound.direction = 'outbound'
				  AND outbound.created_at > inbound.created_at
				ORDER BY outbound.created_at ASC
				LIMIT 1
			) first_reply ON true
			WHERE inbound.workspace_id = $1
			  AND inbound.direction = 'inbound'
			  AND inbound.created_at >= $2
		)
		SELECT to_char(day, 'Dy'), COALESCE(round(avg(replies.seconds)), 0)::int
		FROM generate_series($2::date, ($2::date + (($3 - 1) * interval '1 day')), interval '1 day') day
		LEFT JOIN replies ON replies.day = day
		GROUP BY day
		ORDER BY day`
	rows, err := s.db.Query(ctx, q, workspaceID, start, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []ResponsePoint{}
	for rows.Next() {
		var p ResponsePoint
		if err := rows.Scan(&p.Label, &p.Seconds); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *DashboardService) hourlyActivity(ctx context.Context, workspaceID string, start time.Time) ([]HourlyPoint, error) {
	const q = `
		SELECT lpad(hour::text, 2, '0') || ':00',
		       count(m.id)::int
		FROM generate_series(0, 23) hour
		LEFT JOIN messages m ON m.workspace_id = $1
		 AND m.created_at >= $2
		 AND extract(hour from m.created_at)::int = hour
		GROUP BY hour
		ORDER BY hour`
	rows, err := s.db.Query(ctx, q, workspaceID, start)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []HourlyPoint{}
	for rows.Next() {
		var p HourlyPoint
		if err := rows.Scan(&p.Hour, &p.Total); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *DashboardService) recentConversations(ctx context.Context, workspaceID string) ([]RecentConversation, error) {
	const q = `
		SELECT c.id::text, co.name, ch.type::text, ch.name,
		       c.last_message_preview, c.status::text, c.unread_count, c.last_message_at
		FROM conversations c
		JOIN contacts co ON co.id = c.contact_id
		JOIN channels ch ON ch.id = c.channel_id
		WHERE c.workspace_id = $1
		ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
		LIMIT 8`
	rows, err := s.db.Query(ctx, q, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []RecentConversation{}
	for rows.Next() {
		var c RecentConversation
		if err := rows.Scan(&c.ID, &c.ContactName, &c.ChannelType, &c.ChannelName, &c.Preview, &c.Status, &c.UnreadCount, &c.LastMessageAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func percentDelta(current, previous int) float64 {
	if previous == 0 {
		if current == 0 {
			return 0
		}
		return 100
	}
	return math.Round(((float64(current)-float64(previous))/float64(previous))*1000) / 10
}
