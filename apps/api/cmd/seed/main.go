// Command seed inserts demo data: one workspace, one user per role, the
// matching memberships, and a few sample channels. It is idempotent —
// existing records are left untouched.
//
// Usage:  go run ./cmd/seed
package main

import (
	"context"
	"errors"
	"log"
	"time"

	"github.com/aichat/api/internal/auth"
	"github.com/aichat/api/internal/config"
	"github.com/aichat/api/internal/database"
	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/repositories"
)

type demoContact struct {
	Name  string
	Phone string
	Email string
}

type demoConversation struct {
	ContactIndex int
	ChannelType  models.ChannelType
	Status       models.ConversationStatus
	AssignTo     string // demo user email or "" for unassigned
	Messages     []demoMessage
}

type demoMessage struct {
	Direction models.MessageDirection
	Body      string
}

var demoContacts = []demoContact{
	{"Rina Wijaya", "+628123456789", "rina@example.com"},
	{"Agus Pratama", "+628987654321", "agus@example.com"},
	{"Dewi Lestari", "+628111222333", "dewi@example.com"},
	{"Hendra Gunawan", "+628777888999", "hendra@example.com"},
}

var demoConversations = []demoConversation{
	{
		ContactIndex: 0, ChannelType: models.ChannelWhatsApp,
		Status: models.ConvOpen, AssignTo: "agent@demo.aichat.id",
		Messages: []demoMessage{
			{models.MsgInbound, "Halo, apakah produk masih tersedia?"},
			{models.MsgOutbound, "Halo Rina, tersedia ya kak. Ada pertanyaan lain?"},
			{models.MsgInbound, "Boleh minta harga dan opsi pengirimannya?"},
		},
	},
	{
		ContactIndex: 1, ChannelType: models.ChannelInstagram,
		Status: models.ConvPending, AssignTo: "",
		Messages: []demoMessage{
			{models.MsgInbound, "Permisi, saya tertarik dengan paket bundle nya"},
		},
	},
	{
		ContactIndex: 2, ChannelType: models.ChannelMessenger,
		Status: models.ConvOpen, AssignTo: "owner@demo.aichat.id",
		Messages: []demoMessage{
			{models.MsgInbound, "Apakah bisa kirim ke Bandung hari ini?"},
			{models.MsgOutbound, "Bisa kak, estimasi 1 hari sampai ya."},
		},
	},
	{
		ContactIndex: 3, ChannelType: models.ChannelWhatsApp,
		Status: models.ConvResolved, AssignTo: "agent@demo.aichat.id",
		Messages: []demoMessage{
			{models.MsgInbound, "Oke, sudah saya transfer ya"},
			{models.MsgOutbound, "Sudah kami terima, terima kasih 🙏"},
		},
	},
}

const (
	demoWorkspaceName = "Demo Workspace"
	demoWorkspaceSlug = "demo-workspace"
	demoPassword      = "Password123!"
)

type demoUser struct {
	Name  string
	Email string
	Role  models.MemberRole
}

var demoUsers = []demoUser{
	{"Olivia Owner", "owner@demo.aichat.id", models.RoleOwner},
	{"Adam Admin", "admin@demo.aichat.id", models.RoleAdmin},
	{"Andi Agent", "agent@demo.aichat.id", models.RoleAgent},
	{"Vera Viewer", "viewer@demo.aichat.id", models.RoleViewer},
}

type demoChannel struct {
	Type   models.ChannelType
	Name   string
	Status models.ChannelStatus
}

var demoChannels = []demoChannel{
	{models.ChannelWhatsApp, "WhatsApp Utama", models.StatusConnected},
	{models.ChannelInstagram, "Instagram Toko", models.StatusPending},
	{models.ChannelMessenger, "Messenger Support", models.StatusDisconnected},
}

func main() {
	cfg := config.Load()
	ctx := context.Background()

	pool, err := database.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("seed: database connection failed: %v", err)
	}
	defer pool.Close()

	userRepo := repositories.NewUserRepository(pool)
	workspaceRepo := repositories.NewWorkspaceRepository(pool)
	memberRepo := repositories.NewWorkspaceMemberRepository(pool)
	channelRepo := repositories.NewChannelRepository(pool)

	passwordHash, err := auth.HashPassword(demoPassword)
	if err != nil {
		log.Fatalf("seed: hash password: %v", err)
	}

	// --- Users ------------------------------------------------------------
	userIDs := map[string]string{}
	for _, du := range demoUsers {
		user, err := userRepo.GetByEmail(ctx, du.Email)
		if errors.Is(err, repositories.ErrNotFound) {
			user, err = userRepo.Create(ctx, repositories.CreateUserParams{
				Name:         du.Name,
				Email:        du.Email,
				PasswordHash: passwordHash,
			})
			if err != nil {
				log.Fatalf("seed: create user %s: %v", du.Email, err)
			}
			log.Printf("seed: created user %s", user.Email)
		} else if err != nil {
			log.Fatalf("seed: lookup user %s: %v", du.Email, err)
		} else {
			log.Printf("seed: user %s already exists", user.Email)
		}
		userIDs[du.Email] = user.ID
	}

	// --- Super admin ------------------------------------------------------
	// Promote the demo owner to platform super admin so the /admin surface
	// is reachable out of the box.
	if id, ok := userIDs["owner@demo.aichat.id"]; ok {
		if err := userRepo.SetSuperAdmin(ctx, id, true); err != nil {
			log.Printf("seed: set super admin: %v", err)
		} else {
			log.Printf("seed: owner@demo.aichat.id is now SUPER_ADMIN")
		}
	}

	// --- Workspace --------------------------------------------------------
	ownerID := userIDs["owner@demo.aichat.id"]
	workspace, err := workspaceRepo.GetBySlug(ctx, demoWorkspaceSlug)
	if errors.Is(err, repositories.ErrNotFound) {
		workspace, err = workspaceRepo.Create(ctx, repositories.CreateWorkspaceParams{
			Name:       demoWorkspaceName,
			Slug:       demoWorkspaceSlug,
			OwnerID:    ownerID,
			BrandColor: "#4f46e5",
			Timezone:   "Asia/Jakarta",
		})
		if err != nil {
			log.Fatalf("seed: create workspace: %v", err)
		}
		log.Printf("seed: created workspace %q", workspace.Name)
	} else if err != nil {
		log.Fatalf("seed: lookup workspace: %v", err)
	} else {
		log.Printf("seed: workspace %q already exists", workspace.Name)
	}

	// --- Memberships ------------------------------------------------------
	now := time.Now()
	for _, du := range demoUsers {
		uid := userIDs[du.Email]
		if _, err := memberRepo.Get(ctx, workspace.ID, uid); err == nil {
			log.Printf("seed: membership %-6s %s already exists", du.Role, du.Email)
			continue
		} else if !errors.Is(err, repositories.ErrNotFound) {
			log.Fatalf("seed: lookup membership %s: %v", du.Email, err)
		}
		if _, err := memberRepo.Add(ctx, repositories.AddMemberParams{
			WorkspaceID: workspace.ID,
			UserID:      uid,
			Role:        du.Role,
			Status:      models.MemberActive,
			JoinedAt:    &now,
		}); err != nil {
			log.Fatalf("seed: add member %s: %v", du.Email, err)
		}
		log.Printf("seed: added member %-6s %s", du.Role, du.Email)
	}

	// --- Channels ---------------------------------------------------------
	existing, err := channelRepo.ListByWorkspace(ctx, workspace.ID)
	if err != nil {
		log.Fatalf("seed: list channels: %v", err)
	}
	if len(existing) == 0 {
		for _, dc := range demoChannels {
			if _, err := channelRepo.Create(ctx, repositories.CreateChannelParams{
				WorkspaceID: workspace.ID,
				Type:        dc.Type,
				Name:        dc.Name,
				Status:      dc.Status,
			}); err != nil {
				log.Fatalf("seed: create channel %s: %v", dc.Name, err)
			}
			log.Printf("seed: created channel %-9s %s (%s)", dc.Type, dc.Name, dc.Status)
		}
		existing, _ = channelRepo.ListByWorkspace(ctx, workspace.ID)
	} else {
		log.Printf("seed: %d channel(s) already exist, skipped", len(existing))
	}

	// --- Inbox: contacts + conversations + messages -----------------------
	contactRepo := repositories.NewContactRepository(pool)
	conversationRepo := repositories.NewConversationRepository(pool)
	messageRepo := repositories.NewMessageRepository(pool)

	existingConvs, err := conversationRepo.ListByWorkspace(ctx, workspace.ID)
	if err != nil {
		log.Fatalf("seed: list conversations: %v", err)
	}
	if len(existingConvs) > 0 {
		log.Printf("seed: %d conversation(s) already exist, skipped inbox seed", len(existingConvs))
	} else {
		channelByType := map[models.ChannelType]string{}
		for _, ch := range existing {
			channelByType[ch.Type] = ch.ID
		}

		// Contacts
		contactIDs := make([]string, len(demoContacts))
		for i, dc := range demoContacts {
			phone := dc.Phone
			email := dc.Email
			contact, err := contactRepo.Create(ctx, repositories.CreateContactParams{
				WorkspaceID: workspace.ID,
				Name:        dc.Name,
				Phone:       &phone,
				Email:       &email,
			})
			if err != nil {
				log.Fatalf("seed: create contact %s: %v", dc.Name, err)
			}
			contactIDs[i] = contact.ID
			log.Printf("seed: created contact %s", contact.Name)
		}

		// Conversations + messages
		for _, dcv := range demoConversations {
			channelID, ok := channelByType[dcv.ChannelType]
			if !ok {
				continue
			}
			conv, err := conversationRepo.Create(ctx, repositories.CreateConversationParams{
				WorkspaceID: workspace.ID,
				ChannelID:   channelID,
				ContactID:   contactIDs[dcv.ContactIndex],
				Status:      dcv.Status,
			})
			if err != nil {
				log.Fatalf("seed: create conversation: %v", err)
			}

			if dcv.AssignTo != "" {
				if agentID, ok := userIDs[dcv.AssignTo]; ok {
					_, _ = conversationRepo.Assign(ctx, conv.ID, &agentID)
					_ = conversationRepo.RecordAssignment(ctx, conv.ID, &agentID, &agentID)
				}
			}

			var lastBody string
			inbound := 0
			for _, m := range dcv.Messages {
				body := m.Body
				lastBody = body
				params := repositories.CreateMessageParams{
					ConversationID: conv.ID,
					WorkspaceID:    workspace.ID,
					Direction:      m.Direction,
					Kind:           models.KindText,
					Body:           &body,
					Status:         models.MsgDelivered,
				}
				if m.Direction == models.MsgOutbound {
					if agentID, ok := userIDs["owner@demo.aichat.id"]; ok {
						params.SenderUserID = &agentID
					}
				} else {
					inbound++
				}
				if _, err := messageRepo.Create(ctx, params); err != nil {
					log.Fatalf("seed: create message: %v", err)
				}
			}
			_ = conversationRepo.TouchLastMessage(ctx, conv.ID, lastBody)
			// One inbound stays unread on the unresolved demo conversations.
			if inbound > 0 && dcv.Status != models.ConvResolved {
				_ = conversationRepo.IncrementUnread(ctx, conv.ID)
			}
			log.Printf("seed: created conversation (%s, %s, %d msgs)",
				dcv.ChannelType, dcv.Status, len(dcv.Messages))
		}
	}

	// --- CRM: tags + segments + activities --------------------------------
	tagRepo := repositories.NewTagRepository(pool)
	segmentRepo := repositories.NewSegmentRepository(pool)
	activityRepo := repositories.NewActivityRepository(pool)

	demoTags := []struct {
		Name, Color string
	}{
		{"VIP", "#f59e0b"},
		{"Lead", "#3b82f6"},
		{"Wholesale", "#10b981"},
	}
	existingTags, _ := tagRepo.ListByWorkspace(ctx, workspace.ID)
	tagByName := map[string]string{}
	for _, t := range existingTags {
		tagByName[t.Name] = t.ID
	}
	for _, dt := range demoTags {
		if _, ok := tagByName[dt.Name]; ok {
			continue
		}
		t, err := tagRepo.Create(ctx, workspace.ID, dt.Name, dt.Color)
		if err != nil {
			log.Printf("seed: create tag %s: %v", dt.Name, err)
			continue
		}
		tagByName[t.Name] = t.ID
		log.Printf("seed: created tag %s", t.Name)
	}

	// Attach tags + log an activity for the existing demo contacts.
	allContacts, _ := contactRepo.ListByWorkspace(ctx, workspace.ID)
	tagAssignment := map[string]string{
		"Rina Wijaya":    "VIP",
		"Agus Pratama":   "Lead",
		"Dewi Lestari":   "Lead",
		"Hendra Gunawan": "Wholesale",
	}
	ownerID = userIDs["owner@demo.aichat.id"]
	for _, c := range allContacts {
		if tagName, ok := tagAssignment[c.Name]; ok {
			if tagID, ok := tagByName[tagName]; ok {
				_ = contactRepo.AttachTag(ctx, c.ID, tagID)
			}
		}
		acts, _ := activityRepo.ListByContact(ctx, c.ID)
		if len(acts) == 0 {
			body := "Kontak dibuat dari seed demo"
			_, _ = activityRepo.Create(ctx, repositories.CreateActivityParams{
				ContactID:   c.ID,
				WorkspaceID: workspace.ID,
				ActorID:     &ownerID,
				Kind:        models.ActivityContactCreated,
				Body:        &body,
			})
		}
	}

	// One demo segment ("WhatsApp VIP") if none exist yet.
	existingSegs, _ := segmentRepo.ListByWorkspace(ctx, workspace.ID)
	if len(existingSegs) == 0 {
		desc := "Kontak VIP yang masuk via WhatsApp"
		seg, err := segmentRepo.Create(ctx, repositories.CreateSegmentParams{
			WorkspaceID: workspace.ID,
			Name:        "WhatsApp VIP",
			Description: &desc,
			Color:       "#f59e0b",
			CreatedBy:   &ownerID,
		})
		if err != nil {
			log.Printf("seed: create segment: %v", err)
		} else if vipID, ok := tagByName["VIP"]; ok {
			_, _ = segmentRepo.AddRule(ctx, seg.ID, "tag", "equals", vipID)
			log.Printf("seed: created segment %q", seg.Name)
		}
	}

	log.Println("--------------------------------------------------")
	log.Printf("seed: done. Demo login password for all users: %s", demoPassword)
	log.Println("--------------------------------------------------")
}
