// Package routes wires HTTP endpoints to their handlers.
package routes

import (
	"github.com/labstack/echo/v4"

	"github.com/aichat/api/internal/handlers"
	"github.com/aichat/api/internal/middleware"
	"github.com/aichat/api/internal/models"
)

// Deps bundles everything the router needs.
type Deps struct {
	Auth         *handlers.AuthHandler
	Dashboard    *handlers.DashboardHandler
	Health       *handlers.HealthHandler
	Workspace    *handlers.WorkspaceHandler
	Member       *handlers.MemberHandler
	Channel      *handlers.ChannelHandler
	Conversation *handlers.ConversationHandler
	Message      *handlers.MessageHandler
	Note         *handlers.NoteHandler
	WS           *handlers.WSHandler
	Contact      *handlers.ContactHandler
	Tag          *handlers.TagHandler
	Segment      *handlers.SegmentHandler
	WhatsApp     *handlers.WhatsAppHandler
	Instagram    *handlers.InstagramHandler
	Messenger    *handlers.MessengerHandler
	QuickReply   *handlers.QuickReplyHandler
	Template     *handlers.TemplateHandler
	Interactive  *handlers.InteractiveHandler
	Broadcast    *handlers.BroadcastHandler
	AIAgent      *handlers.AIAgentHandler
	Knowledge    *handlers.KnowledgeHandler
	AI           *handlers.AIHandler
	APIKey       *handlers.APIKeyHandler
	WebhookEP    *handlers.WebhookEndpointHandler
	Public       *handlers.PublicHandler
	Billing      *handlers.BillingHandler
	Admin        *handlers.AdminHandler

	AuthMW      *middleware.AuthMiddleware
	WorkspaceMW *middleware.WorkspaceMiddleware
	APIKeyMW    *middleware.APIKeyMiddleware
	AdminMW     *middleware.AdminMiddleware
}

// Register mounts all routes onto the Echo instance.
func Register(e *echo.Echo, d Deps) {
	e.GET("/health", d.Health.Health)
	// WebSocket: auth is performed inside the handler from the ?token=…
	// query param, because browsers cannot set headers on WS handshakes.
	e.GET("/ws", d.WS.Handle)

	// --- Meta webhooks (no auth — verified by token + HMAC) -----------
	webhooks := e.Group("/api/webhooks")
	webhooks.GET("/whatsapp", d.WhatsApp.VerifyWebhook)
	webhooks.POST("/whatsapp", d.WhatsApp.ReceiveWebhook)
	webhooks.GET("/instagram", d.Instagram.VerifyWebhook)
	webhooks.POST("/instagram", d.Instagram.ReceiveWebhook)
	webhooks.GET("/messenger", d.Messenger.VerifyWebhook)
	webhooks.POST("/messenger", d.Messenger.ReceiveWebhook)

	v1 := e.Group("/api/v1")
	auth := d.AuthMW.RequireAuth()
	ws := d.WorkspaceMW

	// --- Public pricing catalogue (no auth — powers the /pricing page) -
	v1.GET("/plans", d.Billing.ListPlans)

	// --- Authentication -----------------------------------------------
	authGroup := v1.Group("/auth")
	authGroup.POST("/register", d.Auth.Register)
	authGroup.POST("/login", d.Auth.Login)
	authGroup.POST("/refresh", d.Auth.Refresh)
	authGroup.POST("/logout", d.Auth.Logout)
	authGroup.GET("/me", d.Auth.Me, auth)

	// --- Workspaces ---------------------------------------------------
	w := v1.Group("/workspaces", auth)
	w.POST("", d.Workspace.Create)
	w.GET("", d.Workspace.List)
	w.GET("/:id", d.Workspace.Get, ws.RequireWorkspaceRole(models.RoleViewer))
	w.PATCH("/:id", d.Workspace.Update, ws.RequireWorkspaceRole(models.RoleAdmin))
	w.DELETE("/:id", d.Workspace.Delete, ws.RequireWorkspaceRole(models.RoleOwner))
	w.GET("/:id/overview", d.Dashboard.Overview, ws.RequireWorkspaceRole(models.RoleViewer))

	w.GET("/:id/members", d.Member.List, ws.RequireWorkspaceRole(models.RoleViewer))
	w.POST("/:id/invite", d.Member.Invite, ws.RequireWorkspaceRole(models.RoleAdmin))
	w.DELETE("/:id/members/:memberId", d.Member.Remove, ws.RequireWorkspaceRole(models.RoleAdmin))

	w.GET("/:id/channels", d.Channel.List, ws.RequireWorkspaceRole(models.RoleViewer))
	w.POST("/:id/channels", d.Channel.Create, ws.RequireWorkspaceRole(models.RoleAdmin))

	// --- WhatsApp -----------------------------------------------------
	w.GET("/:id/channels/whatsapp",
		d.WhatsApp.ListChannels, ws.RequireWorkspaceRole(models.RoleViewer))
	w.POST("/:id/channels/whatsapp/connect",
		d.WhatsApp.Connect, ws.RequireWorkspaceRole(models.RoleAdmin))

	// --- Instagram ----------------------------------------------------
	w.GET("/:id/channels/instagram",
		d.Instagram.Info, ws.RequireWorkspaceRole(models.RoleViewer))
	w.POST("/:id/channels/instagram/connect",
		d.Instagram.Connect, ws.RequireWorkspaceRole(models.RoleAdmin))

	// --- Messenger ----------------------------------------------------
	w.GET("/:id/channels/messenger",
		d.Messenger.Info, ws.RequireWorkspaceRole(models.RoleViewer))
	w.POST("/:id/channels/messenger/connect",
		d.Messenger.Connect, ws.RequireWorkspaceRole(models.RoleAdmin))

	// --- Inbox (workspace-scoped list) --------------------------------
	w.GET("/:id/conversations",
		d.Conversation.List, ws.RequireWorkspaceRole(models.RoleAgent))

	// --- CRM contacts (workspace-scoped) ------------------------------
	w.GET("/:id/contacts",
		d.Contact.List, ws.RequireWorkspaceRole(models.RoleViewer))
	w.POST("/:id/contacts",
		d.Contact.Create, ws.RequireWorkspaceRole(models.RoleAgent))
	w.GET("/:id/contacts/duplicates",
		d.Contact.Duplicates, ws.RequireWorkspaceRole(models.RoleAgent))
	w.POST("/:id/contacts/import",
		d.Contact.Import, ws.RequireWorkspaceRole(models.RoleAgent))
	w.GET("/:id/contacts/export",
		d.Contact.Export, ws.RequireWorkspaceRole(models.RoleViewer))

	// --- Tags ---------------------------------------------------------
	w.GET("/:id/tags",
		d.Tag.List, ws.RequireWorkspaceRole(models.RoleViewer))
	w.POST("/:id/tags",
		d.Tag.Create, ws.RequireWorkspaceRole(models.RoleAgent))
	w.DELETE("/:id/tags/:tagId",
		d.Tag.Delete, ws.RequireWorkspaceRole(models.RoleAgent))

	// --- Quick replies ------------------------------------------------
	w.GET("/:id/quick-replies",
		d.QuickReply.List, ws.RequireWorkspaceRole(models.RoleViewer))
	w.POST("/:id/quick-replies",
		d.QuickReply.Create, ws.RequireWorkspaceRole(models.RoleAgent))
	w.PATCH("/:id/quick-replies/:replyId",
		d.QuickReply.Update, ws.RequireWorkspaceRole(models.RoleAgent))
	w.DELETE("/:id/quick-replies/:replyId",
		d.QuickReply.Delete, ws.RequireWorkspaceRole(models.RoleAgent))

	// --- Templates ----------------------------------------------------
	w.GET("/:id/templates",
		d.Template.List, ws.RequireWorkspaceRole(models.RoleViewer))
	w.POST("/:id/templates",
		d.Template.Create, ws.RequireWorkspaceRole(models.RoleAgent))
	w.GET("/:id/templates/:templateId",
		d.Template.Get, ws.RequireWorkspaceRole(models.RoleViewer))
	w.PATCH("/:id/templates/:templateId",
		d.Template.Update, ws.RequireWorkspaceRole(models.RoleAgent))
	w.DELETE("/:id/templates/:templateId",
		d.Template.Delete, ws.RequireWorkspaceRole(models.RoleAgent))
	w.POST("/:id/templates/:templateId/submit",
		d.Template.Submit, ws.RequireWorkspaceRole(models.RoleAdmin))
	w.POST("/:id/templates/:templateId/use",
		d.Template.Use, ws.RequireWorkspaceRole(models.RoleAgent))

	// --- Broadcasts ---------------------------------------------------
	w.GET("/:id/broadcasts",
		d.Broadcast.List, ws.RequireWorkspaceRole(models.RoleViewer))
	w.POST("/:id/broadcasts",
		d.Broadcast.Create, ws.RequireWorkspaceRole(models.RoleAdmin))
	w.GET("/:id/broadcasts/:campaignId",
		d.Broadcast.Get, ws.RequireWorkspaceRole(models.RoleViewer))
	w.POST("/:id/broadcasts/:campaignId/schedule",
		d.Broadcast.Schedule, ws.RequireWorkspaceRole(models.RoleAdmin))
	w.POST("/:id/broadcasts/:campaignId/cancel",
		d.Broadcast.Cancel, ws.RequireWorkspaceRole(models.RoleAdmin))

	// --- Interactive messages -----------------------------------------
	w.GET("/:id/interactive-messages",
		d.Interactive.List, ws.RequireWorkspaceRole(models.RoleViewer))
	w.POST("/:id/interactive-messages",
		d.Interactive.Create, ws.RequireWorkspaceRole(models.RoleAgent))
	w.GET("/:id/interactive-messages/:interactiveId",
		d.Interactive.Get, ws.RequireWorkspaceRole(models.RoleViewer))
	w.PATCH("/:id/interactive-messages/:interactiveId",
		d.Interactive.Update, ws.RequireWorkspaceRole(models.RoleAgent))
	w.DELETE("/:id/interactive-messages/:interactiveId",
		d.Interactive.Delete, ws.RequireWorkspaceRole(models.RoleAgent))

	// --- AI agent + knowledge base ------------------------------------
	w.GET("/:id/ai-agent",
		d.AIAgent.Get, ws.RequireWorkspaceRole(models.RoleViewer))
	w.PATCH("/:id/ai-agent",
		d.AIAgent.Update, ws.RequireWorkspaceRole(models.RoleAdmin))
	w.POST("/:id/ai-agent/approve",
		d.AIAgent.Approve, ws.RequireWorkspaceRole(models.RoleAdmin))
	w.POST("/:id/ai-agent/reject",
		d.AIAgent.Reject, ws.RequireWorkspaceRole(models.RoleAdmin))
	w.GET("/:id/ai-agent/reviews",
		d.AIAgent.Reviews, ws.RequireWorkspaceRole(models.RoleViewer))

	w.GET("/:id/knowledge",
		d.Knowledge.List, ws.RequireWorkspaceRole(models.RoleViewer))
	w.POST("/:id/knowledge",
		d.Knowledge.Create, ws.RequireWorkspaceRole(models.RoleAdmin))
	w.POST("/:id/knowledge/upload",
		d.Knowledge.Upload, ws.RequireWorkspaceRole(models.RoleAdmin))
	w.GET("/:id/knowledge/search",
		d.Knowledge.Search, ws.RequireWorkspaceRole(models.RoleAgent))
	w.DELETE("/:id/knowledge/:docId",
		d.Knowledge.Delete, ws.RequireWorkspaceRole(models.RoleAdmin))

	w.POST("/:id/ai/playground",
		d.AI.Playground, ws.RequireWorkspaceRole(models.RoleAgent))
	w.GET("/:id/ai/logs",
		d.AI.Logs, ws.RequireWorkspaceRole(models.RoleAdmin))

	// --- Developer API keys (management) ------------------------------
	w.GET("/:id/api-keys",
		d.APIKey.List, ws.RequireWorkspaceRole(models.RoleAdmin))
	w.POST("/:id/api-keys",
		d.APIKey.Create, ws.RequireWorkspaceRole(models.RoleAdmin))
	w.GET("/:id/api-keys/usage",
		d.APIKey.UsageLogs, ws.RequireWorkspaceRole(models.RoleAdmin))

	// --- Webhook endpoints (management) -------------------------------
	w.GET("/:id/webhook-endpoints",
		d.WebhookEP.List, ws.RequireWorkspaceRole(models.RoleAdmin))
	w.POST("/:id/webhook-endpoints",
		d.WebhookEP.Create, ws.RequireWorkspaceRole(models.RoleAdmin))

	// --- Billing + plan + usage + invoices ----------------------------
	w.GET("/:id/billing",
		d.Billing.GetBilling, ws.RequireWorkspaceRole(models.RoleViewer))
	w.POST("/:id/billing/change-plan",
		d.Billing.ChangePlan, ws.RequireWorkspaceRole(models.RoleOwner))
	w.GET("/:id/usage",
		d.Billing.GetUsage, ws.RequireWorkspaceRole(models.RoleViewer))
	w.GET("/:id/invoices",
		d.Billing.ListInvoices, ws.RequireWorkspaceRole(models.RoleAdmin))

	// --- Segments -----------------------------------------------------
	w.GET("/:id/segments",
		d.Segment.List, ws.RequireWorkspaceRole(models.RoleViewer))
	w.POST("/:id/segments",
		d.Segment.Create, ws.RequireWorkspaceRole(models.RoleAdmin))
	w.GET("/:id/segments/:segmentId",
		d.Segment.Get, ws.RequireWorkspaceRole(models.RoleViewer))
	w.DELETE("/:id/segments/:segmentId",
		d.Segment.Delete, ws.RequireWorkspaceRole(models.RoleAdmin))

	// --- Channels (resolved via channel id) ---------------------------
	ch := v1.Group("/channels", auth)
	ch.POST("/whatsapp/send", d.WhatsApp.Send)
	ch.POST("/instagram/send", d.Instagram.Send)
	ch.POST("/messenger/send", d.Messenger.Send)
	ch.PATCH("/:id", d.Channel.Update, ws.RequireChannelRole(models.RoleAdmin))
	ch.DELETE("/:id", d.Channel.Delete, ws.RequireChannelRole(models.RoleAdmin))

	// --- Inbox (resolved via conversation id) -------------------------
	conv := v1.Group("/conversations", auth)
	conv.GET("/:id", d.Conversation.Get, ws.RequireConversationRole(models.RoleAgent))
	conv.PATCH("/:id/status", d.Conversation.UpdateStatus, ws.RequireConversationRole(models.RoleAgent))
	conv.PATCH("/:id/assign", d.Conversation.Assign, ws.RequireConversationRole(models.RoleAgent))
	conv.GET("/:id/messages", d.Message.List, ws.RequireConversationRole(models.RoleAgent))
	conv.POST("/:id/messages", d.Message.Send, ws.RequireConversationRole(models.RoleAgent))
	conv.GET("/:id/notes", d.Note.List, ws.RequireConversationRole(models.RoleAgent))
	conv.POST("/:id/notes", d.Note.Create, ws.RequireConversationRole(models.RoleAgent))

	// --- CRM contacts (resolved via contact id) -----------------------
	con := v1.Group("/contacts", auth)
	con.GET("/:id", d.Contact.Get, ws.RequireContactRole(models.RoleViewer))
	con.PATCH("/:id", d.Contact.Update, ws.RequireContactRole(models.RoleAgent))
	con.DELETE("/:id", d.Contact.Delete, ws.RequireContactRole(models.RoleAgent))
	con.POST("/:id/tags", d.Contact.AttachTag, ws.RequireContactRole(models.RoleAgent))
	con.DELETE("/:id/tags/:tagId", d.Contact.DetachTag, ws.RequireContactRole(models.RoleAgent))
	con.POST("/:id/merge", d.Contact.Merge, ws.RequireContactRole(models.RoleAdmin))

	// --- Developer API keys (resolved via key id) ---------------------
	keys := v1.Group("/api-keys", auth)
	keys.DELETE("/:id", d.APIKey.Revoke, ws.RequireAPIKeyRole(models.RoleAdmin))

	// --- Webhook endpoints (resolved via endpoint id) -----------------
	whep := v1.Group("/webhook-endpoints", auth)
	whep.PATCH("/:id", d.WebhookEP.Update, ws.RequireWebhookRole(models.RoleAdmin))
	whep.DELETE("/:id", d.WebhookEP.Delete, ws.RequireWebhookRole(models.RoleAdmin))
	whep.POST("/:id/rotate-secret", d.WebhookEP.RotateSecret, ws.RequireWebhookRole(models.RoleAdmin))
	whep.POST("/:id/test", d.WebhookEP.Test, ws.RequireWebhookRole(models.RoleAdmin))
	whep.GET("/:id/deliveries", d.WebhookEP.DeliveryLogs, ws.RequireWebhookRole(models.RoleViewer))

	// Static catalogue of emit-able webhook events (auth only).
	v1.GET("/webhook-events", d.WebhookEP.Events, auth)

	// --- Super Admin (platform-level, SUPER_ADMIN only) ---------------
	// Chain: RequireAuth → RequireSuperAdmin. The admin middleware loads
	// the user and verifies the platform is_super_admin flag.
	admin := v1.Group("/admin", auth, d.AdminMW.RequireSuperAdmin())
	admin.GET("/overview", d.Admin.Overview)
	admin.GET("/users", d.Admin.Users)
	admin.GET("/workspaces", d.Admin.Workspaces)
	admin.GET("/subscriptions", d.Admin.Subscriptions)
	admin.GET("/channels", d.Admin.Channels)
	admin.GET("/logs", d.Admin.Logs)
	admin.GET("/audit-logs", d.Admin.AuditLogs)
	admin.GET("/reports", d.Admin.Reports)
	admin.POST("/workspaces/:id/suspend", d.Admin.Suspend)
	admin.POST("/reports/:id/resolve", d.Admin.ResolveReport)
	admin.POST("/users/:id/impersonate", d.Admin.Impersonate)

	// --- Public developer API (API-key authenticated) -----------------
	// Mounted under /api/v1/public to avoid colliding with the JWT
	// dashboard routes (e.g. /conversations/:id/messages). The workspace
	// is resolved from the API key by APIKeyMW.Authenticate(), so no
	// :workspaceId path param is needed.
	pub := v1.Group("/public", d.APIKeyMW.Authenticate())
	pub.POST("/messages/send", d.Public.SendMessage)
	pub.POST("/messages/template", d.Public.SendTemplate)
	pub.GET("/contacts", d.Public.ListContacts)
	pub.POST("/contacts", d.Public.CreateContact)
	pub.GET("/conversations", d.Public.ListConversations)
	pub.GET("/conversations/:id/messages", d.Public.ListMessages)
}
