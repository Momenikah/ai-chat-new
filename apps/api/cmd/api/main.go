// Command api is the AI Chat HTTP/REST + WebSocket server.
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"

	"github.com/aichat/api/internal/ai"
	"github.com/aichat/api/internal/auth"
	"github.com/aichat/api/internal/config"
	"github.com/aichat/api/internal/crypto"
	"github.com/aichat/api/internal/database"
	"github.com/aichat/api/internal/handlers"
	"github.com/aichat/api/internal/meta"
	"github.com/aichat/api/internal/midtrans"
	appmw "github.com/aichat/api/internal/middleware"
	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/netguard"
	"github.com/aichat/api/internal/ratelimit"
	"github.com/aichat/api/internal/realtime"
	"github.com/aichat/api/internal/redis"
	"github.com/aichat/api/internal/repositories"
	"github.com/aichat/api/internal/routes"
	"github.com/aichat/api/internal/services"
	"github.com/aichat/api/internal/utils"
	"github.com/aichat/api/internal/wagateway"
	"github.com/aichat/api/internal/webhook"
	"github.com/aichat/api/internal/whatsapp"
)

func main() {
	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		log.Fatalf("api: invalid configuration:\n%v", err)
	}
	rootCtx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// --- Infrastructure ---------------------------------------------------
	pool, err := database.New(rootCtx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("api: database connection failed: %v", err)
	}
	defer pool.Close()
	log.Println("api: connected to PostgreSQL")

	rdb, err := redis.New(rootCtx, cfg.RedisURL)
	if err != nil {
		log.Fatalf("api: redis connection failed: %v", err)
	}
	defer rdb.Close()
	log.Println("api: connected to Redis")

	encryptor, err := crypto.NewEncryptor(cfg.ChannelEncryptionKey)
	if err != nil {
		log.Fatalf("api: encryptor init failed: %v", err)
	}

	if err := os.MkdirAll(cfg.UploadDir, 0o755); err != nil {
		log.Printf("api: could not create upload dir: %v", err)
	}

	// --- Wiring -----------------------------------------------------------
	tokenManager := auth.NewTokenManager(cfg.JWTSecret, cfg.JWTAccessTTL, cfg.JWTRefreshTTL)

	userRepo := repositories.NewUserRepository(pool)
	workspaceRepo := repositories.NewWorkspaceRepository(pool)
	memberRepo := repositories.NewWorkspaceMemberRepository(pool)
	invitationRepo := repositories.NewInvitationRepository(pool)
	channelRepo := repositories.NewChannelRepository(pool)
	tokenRepo := repositories.NewRefreshTokenRepository(pool)

	contactRepo := repositories.NewContactRepository(pool)
	conversationRepo := repositories.NewConversationRepository(pool)
	messageRepo := repositories.NewMessageRepository(pool)
	noteRepo := repositories.NewNoteRepository(pool)
	presenceRepo := repositories.NewPresenceRepository(pool)
	tagRepo := repositories.NewTagRepository(pool)
	segmentRepo := repositories.NewSegmentRepository(pool)
	activityRepo := repositories.NewActivityRepository(pool)
	webhookLogRepo := repositories.NewWebhookLogRepository(pool)
	quickReplyRepo := repositories.NewQuickReplyRepository(pool)
	templateRepo := repositories.NewTemplateRepository(pool)
	interactiveRepo := repositories.NewInteractiveRepository(pool)
	broadcastRepo := repositories.NewBroadcastRepository(pool)
	aiRepo := repositories.NewAIRepository(pool)
	apiKeyRepo := repositories.NewAPIKeyRepository(pool)
	webhookEndpointRepo := repositories.NewWebhookEndpointRepository(pool)
	billingRepo := repositories.NewBillingRepository(pool)
	adminRepo := repositories.NewAdminRepository(pool)

	// --- Realtime hub -----------------------------------------------------
	hub := realtime.NewHub()
	go hub.Run(rootCtx)

	authService := services.NewAuthService(pool, userRepo, workspaceRepo, memberRepo, tokenRepo, tokenManager)
	workspaceService := services.NewWorkspaceService(pool, workspaceRepo, memberRepo)
	memberService := services.NewMemberService(pool, userRepo, memberRepo, invitationRepo)
	channelService := services.NewChannelService(channelRepo, encryptor)
	dashboardService := services.NewDashboardService(pool, memberRepo, channelRepo)

	presenceService := services.NewPresenceService(presenceRepo, hub)
	conversationService := services.NewConversationService(conversationRepo, contactRepo, hub)
	noteService := services.NewNoteService(noteRepo, conversationRepo, hub)
	contactService := services.NewContactService(pool, contactRepo, tagRepo, activityRepo)
	tagService := services.NewTagService(tagRepo, contactRepo)
	segmentService := services.NewSegmentService(pool, segmentRepo, contactRepo)

	whatsappClient := whatsapp.NewClient(cfg.WhatsAppAPIBaseURL)
	whatsappService := services.NewWhatsAppService(
		pool, channelRepo, contactRepo, conversationRepo, messageRepo,
		memberRepo, webhookLogRepo, encryptor, whatsappClient, hub,
		cfg.WhatsAppVerifyToken, cfg.WhatsAppAppSecret,
		cfg.UploadDir, cfg.BaseURL,
	)

	metaClient := meta.NewClient(cfg.MetaAPIBaseURL)
	instagramService := services.NewInstagramService(
		pool, channelRepo, contactRepo, conversationRepo, messageRepo,
		memberRepo, webhookLogRepo, encryptor, metaClient, hub,
		cfg.InstagramVerifyToken, cfg.MetaAppSecret, cfg.BaseURL,
	)
	messengerService := services.NewMessengerService(
		pool, channelRepo, contactRepo, conversationRepo, messageRepo,
		memberRepo, webhookLogRepo, encryptor, metaClient, hub,
		cfg.MessengerVerifyToken, cfg.MetaAppSecret, cfg.BaseURL,
	)

	// Unofficial WhatsApp gateways. OneSender instance URLs come from
	// tenants, so the HTTP client is SSRF-guarded like outbound webhooks.
	gatewayService := services.NewGatewayService(
		channelRepo, contactRepo, conversationRepo, messageRepo,
		memberRepo, webhookLogRepo, encryptor,
		wagateway.NewClient(
			netguard.NewHTTPClient(30*time.Second, cfg.WebhookAllowPrivateTargets),
			cfg.StarSenderAPIURL),
		hub, cfg.BaseURL, cfg.WebhookAllowPrivateTargets,
	)

	quickReplyService := services.NewQuickReplyService(quickReplyRepo)
	templateService := services.NewTemplateService(pool, templateRepo)
	interactiveService := services.NewInteractiveService(interactiveRepo)
	broadcastService := services.NewBroadcastService(
		pool, broadcastRepo, contactRepo, channelRepo, templateRepo,
		segmentService, encryptor, rdb, cfg.BroadcastQueueKey,
	)

	channelDeliverers := map[models.ChannelType]services.ChannelDeliverer{
		models.ChannelWhatsApp:  whatsappService,
		models.ChannelInstagram: instagramService,
		models.ChannelMessenger: messengerService,
		models.ChannelOneSender:  gatewayService,
		models.ChannelStarSender: gatewayService,
	}
	messageService := services.NewMessageService(
		conversationRepo, messageRepo, channelRepo,
		channelDeliverers, hub, cfg.InboxDemoEcho,
	)

	// --- AI ---------------------------------------------------------------
	// Selecting the provider here keeps the AI API key server-side only;
	// the frontend never receives it.
	llm := buildLLM(cfg)
	aiAgentService := services.NewAIAgentService(aiRepo)
	knowledgeService := services.NewKnowledgeService(aiRepo, llm, cfg.AIChunkSize)
	aiReplyService := services.NewAIReplyService(
		aiRepo, aiAgentService, knowledgeService,
		conversationRepo, messageRepo, channelRepo,
		channelDeliverers, llm,
	)
	// Wire the AI auto-reply hook into every provider service so inbound
	// messages flow through the bot when allowed.
	whatsappService.SetAutoReplier(aiReplyService)
	instagramService.SetAutoReplier(aiReplyService)
	messengerService.SetAutoReplier(aiReplyService)
	gatewayService.SetAutoReplier(aiReplyService)

	// --- Developer API + Webhooks (Part 10) -------------------------------
	// The async dispatcher delivers outbound webhooks off the request path
	// with HMAC signing + exponential-backoff retries.
	webhookDispatcher := webhook.NewAsyncDispatcher(
		webhookEndpointRepo, cfg.WebhookWorkers, cfg.WebhookQueueSize,
		cfg.WebhookAllowPrivateTargets)
	webhookDispatcher.Start(rootCtx)

	apiKeyService := services.NewAPIKeyService(apiKeyRepo)
	webhookService := services.NewWebhookService(webhookEndpointRepo, webhookDispatcher)
	webhookService.SetAllowPrivateTargets(cfg.WebhookAllowPrivateTargets)
	publicAPIService := services.NewPublicAPIService(
		channelRepo, contactRepo, conversationRepo, messageRepo,
		contactService, templateService, channelDeliverers,
	)

	// Emit webhook events from the services that own each lifecycle moment.
	// (broadcast.completed is emitted by the worker process, which marks the
	// campaign complete after the last recipient drains.)
	whatsappService.SetWebhookDispatcher(webhookDispatcher)
	instagramService.SetWebhookDispatcher(webhookDispatcher)
	messengerService.SetWebhookDispatcher(webhookDispatcher)
	gatewayService.SetWebhookDispatcher(webhookDispatcher)
	contactService.SetWebhookDispatcher(webhookDispatcher)
	conversationService.SetWebhookDispatcher(webhookDispatcher)

	// --- Billing + plan limits (Part 11) ----------------------------------
	midtransClient := midtrans.NewClient(cfg.MidtransServerKey, cfg.MidtransBaseURL)
	billingService := services.NewBillingService(
		billingRepo, memberRepo, aiRepo, channelRepo, messageRepo, apiKeyRepo,
		midtransClient,
	)
	planGuard := services.NewPlanGuard(billingRepo)

	// --- Super Admin (Part 12) --------------------------------------------
	adminService := services.NewAdminService(adminRepo, userRepo, workspaceRepo)
	systemLogger := services.NewSystemLogger(adminRepo)

	// Wire plan enforcement into every gated feature.
	memberService.SetPlanEnforcer(planGuard)
	knowledgeService.SetPlanEnforcer(planGuard)
	aiAgentService.SetPlanEnforcer(planGuard)
	apiKeyService.SetPlanEnforcer(planGuard)
	webhookService.SetPlanEnforcer(planGuard)
	whatsappService.SetPlanEnforcer(planGuard)
	gatewayService.SetPlanEnforcer(planGuard)
	messageService.SetPlanEnforcer(planGuard)
	publicAPIService.SetPlanEnforcer(planGuard)

	// Mark agents offline when their WS connection drops.
	hub.OnDisconnect = func(userID, workspaceID string) {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = presenceService.Set(ctx, userID, workspaceID, "offline")
	}

	// Brute-force protection for /auth, shared across replicas via Redis.
	rateStore := ratelimit.NewRedisStore(rdb)
	authHandler := handlers.NewAuthHandler(authService)
	authHandler.SetThrottle(handlers.AuthThrottle{
		PerIP:         ratelimit.New(rateStore, "authrl", cfg.AuthIPRatePerMinute, time.Minute),
		LoginFailures: ratelimit.New(rateStore, "loginfail", cfg.LoginMaxFailures, cfg.LoginFailureWindow),
	})

	deps := routes.Deps{
		Auth:         authHandler,
		Dashboard:    handlers.NewDashboardHandler(dashboardService),
		Health:       handlers.NewHealthHandler(pool, rdb),
		Workspace:    handlers.NewWorkspaceHandler(workspaceService),
		Member:       handlers.NewMemberHandler(memberService),
		Channel:      handlers.NewChannelHandler(channelService),
		Conversation: handlers.NewConversationHandler(conversationService),
		Message:      handlers.NewMessageHandler(messageService),
		Note:         handlers.NewNoteHandler(noteService),
		WS:           handlers.NewWSHandler(hub, tokenManager, memberRepo, workspaceRepo, presenceService),
		Contact:      handlers.NewContactHandler(contactService),
		Tag:          handlers.NewTagHandler(tagService),
		Segment:      handlers.NewSegmentHandler(segmentService),
		WhatsApp:     handlers.NewWhatsAppHandler(whatsappService),
		Instagram:    handlers.NewInstagramHandler(instagramService),
		Messenger:    handlers.NewMessengerHandler(messengerService),
		QuickReply:   handlers.NewQuickReplyHandler(quickReplyService),
		Template:     handlers.NewTemplateHandler(templateService),
		Interactive:  handlers.NewInteractiveHandler(interactiveService),
		Broadcast:    handlers.NewBroadcastHandler(broadcastService),
		AIAgent:      handlers.NewAIAgentHandler(aiAgentService),
		Knowledge:    handlers.NewKnowledgeHandler(knowledgeService, aiAgentService),
		AI:           handlers.NewAIHandler(aiReplyService, aiRepo),
		APIKey:       handlers.NewAPIKeyHandler(apiKeyService),
		WebhookEP:    handlers.NewWebhookEndpointHandler(webhookService),
		Public:       handlers.NewPublicHandler(publicAPIService),
		Billing:      handlers.NewBillingHandler(billingService),
		Admin:        handlers.NewAdminHandler(adminService),
		Gateway:      handlers.NewGatewayHandler(gatewayService),
		AuthMW:       appmw.NewAuthMiddleware(tokenManager),
		WorkspaceMW: appmw.NewWorkspaceMiddleware(
			memberRepo, channelRepo, conversationRepo, contactRepo,
			apiKeyRepo, webhookEndpointRepo, workspaceRepo),
		APIKeyMW: appmw.NewAPIKeyMiddleware(apiKeyRepo, workspaceRepo, rateStore, cfg.APIRateLimitPerMinute),
		AdminMW:  appmw.NewAdminMiddleware(userRepo),
	}

	// --- Echo -------------------------------------------------------------
	e := echo.New()
	e.HideBanner = true
	e.HidePort = true
	e.Validator = utils.NewValidator()
	// Only trust X-Forwarded-For when it was set by a proxy on a
	// loopback/private network (plus any TRUSTED_PROXIES), so direct
	// clients cannot spoof their IP — the auth rate limiter and audit logs
	// rely on it.
	trustOpts := make([]echo.TrustOption, 0, len(cfg.TrustedProxies))
	for _, cidr := range cfg.TrustedProxies {
		trustOpts = append(trustOpts, echo.TrustIPRange(cidr))
	}
	e.IPExtractor = echo.ExtractIPFromXFFHeader(trustOpts...)
	// Guard against slowloris-style header dribbling. No global
	// read/write timeout: uploads, AI calls and WebSockets are long-lived.
	e.Server.ReadHeaderTimeout = 10 * time.Second
	e.Server.IdleTimeout = 120 * time.Second

	// Capture server errors (5xx) into system_logs for the admin error-log
	// viewer, then delegate to Echo's default handler.
	defaultErrorHandler := e.HTTPErrorHandler
	e.HTTPErrorHandler = func(err error, c echo.Context) {
		// Handlers that already wrote their own response (e.g. a 422 from
		// bindAndValidate returning errRequestHandled) are not server
		// errors — don't log them as 500s or write a second body.
		if c.Response().Committed {
			return
		}
		status := http.StatusInternalServerError
		if he, ok := err.(*echo.HTTPError); ok {
			status = he.Code
		}
		if status >= 500 {
			systemLogger.Error("http", err.Error(), map[string]any{
				"method": c.Request().Method,
				"path":   c.Request().URL.Path,
				"status": status,
			})
		}
		defaultErrorHandler(err, c)
	}

	e.Use(echomw.Recover())
	e.Use(echomw.BodyLimit(cfg.MaxBodySize))
	e.Use(echomw.Secure())
	e.Use(echomw.RequestLoggerWithConfig(echomw.RequestLoggerConfig{
		LogStatus: true, LogMethod: true, LogURI: true, LogLatency: true,
		LogValuesFunc: func(c echo.Context, v echomw.RequestLoggerValues) error {
			log.Printf("%d %s %s (%s)", v.Status, v.Method, v.URI, v.Latency)
			return nil
		},
	}))
	e.Use(echomw.CORSWithConfig(echomw.CORSConfig{
		AllowOrigins:     cfg.CORSOrigins,
		AllowMethods:     []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete},
		AllowHeaders:     []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAuthorization},
		AllowCredentials: true,
	}))

	// Serve uploaded media (e.g. incoming WhatsApp attachments) under /static.
	e.Static("/static", cfg.UploadDir)

	routes.Register(e, deps)

	// --- Serve with graceful shutdown -------------------------------------
	go func() {
		addr := ":" + cfg.Port
		log.Printf("api: listening on %s (env=%s, inbox_demo_echo=%t)",
			addr, cfg.AppEnv, cfg.InboxDemoEcho)
		if err := e.Start(addr); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("api: server error: %v", err)
		}
	}()

	log.Printf("api: ai provider=%s model=%s embed=%s",
		llm.Name(), cfg.AIChatModel, cfg.AIEmbeddingModel)

	<-rootCtx.Done()
	log.Println("api: shutting down…")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := e.Shutdown(shutdownCtx); err != nil {
		log.Printf("api: graceful shutdown failed: %v", err)
	}
	log.Println("api: stopped")
}

// buildLLM resolves the AI provider based on AI_PROVIDER. The mock
// provider is the default so the app remains usable without an API key.
// Setting AI_PROVIDER=openai with an empty AI_API_KEY falls back to the
// mock provider with a warning to avoid runtime failures.
func buildLLM(cfg *config.Config) ai.LLM {
	switch cfg.AIProvider {
	case "openai":
		p, err := ai.NewOpenAIProvider(cfg.AIBaseURL, cfg.AIAPIKey)
		if err != nil {
			log.Printf("api: AI provider 'openai' selected but not configured (%v); falling back to mock", err)
			return ai.NewMockProvider(0)
		}
		return p
	default:
		return ai.NewMockProvider(0)
	}
}
