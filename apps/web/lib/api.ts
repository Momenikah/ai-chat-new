import type {
  AbuseReport,
  AdminAuditLog,
  AdminChannelListItem,
  AdminSubscriptionListItem,
  AdminUserListItem,
  AdminWorkspaceListItem,
  AIAgent,
  AIPromptReview,
  APIKey,
  APIUsageLog,
  AudienceFilter,
  AudienceKind,
  AuthResponse,
  BillingSummary,
  BotReplyLog,
  BroadcastCampaign,
  BroadcastDetail,
  ChangePlanResult,
  Channel,
  ChannelType,
  Contact,
  ContactDetail,
  ContactImportResult,
  Conversation,
  ConversationDetail,
  ConversationListItem,
  ConversationStatus,
  CreatedAPIKey,
  DashboardOverview,
  ImpersonateResult,
  InteractiveKind,
  InteractiveMessage,
  InteractivePayload,
  InternalNote,
  Invoice,
  KnowledgeDocument,
  KnowledgeSearchResult,
  MemberRole,
  Message,
  MessageKind,
  MessageTemplate,
  PlatformOverview,
  PlaygroundResult,
  QuickReply,
  SaasPlan,
  SegmentWithRules,
  SystemLog,
  Tag,
  TemplateButton,
  TemplateCategory,
  TemplateWithVariables,
  TeamListing,
  UsageSummary,
  User,
  WebhookDeliveryLog,
  WebhookEndpoint,
  Workspace,
  WorkspaceWithRole,
} from "@aichat/shared";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  storeTokens,
} from "./auth";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

export class ApiException extends Error {
  status: number;
  details?: Record<string, string>;

  constructor(
    status: number,
    message: string,
    details?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiException";
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  auth?: boolean;
  _retry?: boolean;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, auth = true, _retry, headers, ...rest } = options;

  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string>),
  };

  if (auth) {
    const token = getAccessToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth && !_retry) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request<T>(path, { ...options, _retry: true });
    }
    clearTokens();
  }

  if (res.status === 204) return undefined as T;

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiException(
      res.status,
      payload?.message ?? payload?.error ?? "Terjadi kesalahan",
      payload?.details,
    );
  }

  return payload as T;
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!res.ok) return false;
        const data = (await res.json()) as AuthResponse;
        storeTokens(data.access_token, data.refresh_token);
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

/* --------------------------------- API --------------------------------- */

export const api = {
  auth: {
    register: (input: {
      workspace_name: string;
      name: string;
      email: string;
      password: string;
    }) =>
      request<AuthResponse>("/auth/register", {
        method: "POST",
        body: input,
        auth: false,
      }),

    login: (input: { email: string; password: string }) =>
      request<AuthResponse>("/auth/login", {
        method: "POST",
        body: input,
        auth: false,
      }),

    logout: () => {
      const refresh_token = getRefreshToken();
      return request<void>("/auth/logout", {
        method: "POST",
        body: { refresh_token },
      });
    },

    me: () => request<User>("/auth/me"),
  },

  workspaces: {
    list: () =>
      request<{ workspaces: WorkspaceWithRole[] }>("/workspaces"),

    create: (input: {
      name: string;
      brand_color?: string;
      timezone?: string;
    }) =>
      request<WorkspaceWithRole>("/workspaces", {
        method: "POST",
        body: input,
      }),

    get: (id: string) =>
      request<{ workspace: Workspace; member_role: MemberRole }>(
        `/workspaces/${id}`,
      ),

    update: (
      id: string,
      input: {
        name?: string;
        logo_url?: string | null;
        brand_color?: string;
        timezone?: string;
      },
    ) =>
      request<Workspace>(`/workspaces/${id}`, {
        method: "PATCH",
        body: input,
      }),

    remove: (id: string) =>
      request<void>(`/workspaces/${id}`, { method: "DELETE" }),
  },

  members: {
    list: (workspaceId: string) =>
      request<TeamListing>(`/workspaces/${workspaceId}/members`),

    invite: (
      workspaceId: string,
      input: { email: string; role: MemberRole },
    ) =>
      request<{ auto_joined: boolean }>(
        `/workspaces/${workspaceId}/invite`,
        { method: "POST", body: input },
      ),

    remove: (workspaceId: string, memberId: string) =>
      request<void>(`/workspaces/${workspaceId}/members/${memberId}`, {
        method: "DELETE",
      }),
  },

  channels: {
    list: (workspaceId: string) =>
      request<{ channels: Channel[] }>(
        `/workspaces/${workspaceId}/channels`,
      ),

    create: (
      workspaceId: string,
      input: {
        type: ChannelType;
        name: string;
        external_id?: string;
        credentials?: Record<string, unknown>;
      },
    ) =>
      request<Channel>(`/workspaces/${workspaceId}/channels`, {
        method: "POST",
        body: input,
      }),

    update: (
      channelId: string,
      input: {
        name?: string;
        status?: string;
        external_id?: string;
        credentials?: Record<string, unknown>;
      },
    ) =>
      request<Channel>(`/channels/${channelId}`, {
        method: "PATCH",
        body: input,
      }),

    remove: (channelId: string) =>
      request<void>(`/channels/${channelId}`, { method: "DELETE" }),
  },

  dashboard: {
    overview: (workspaceId: string, days = 7) =>
      request<DashboardOverview>(
        `/workspaces/${workspaceId}/overview?days=${days}`,
      ),
  },

  conversations: {
    list: (workspaceId: string) =>
      request<{ conversations: ConversationListItem[] }>(
        `/workspaces/${workspaceId}/conversations`,
      ),

    get: (conversationId: string) =>
      request<ConversationDetail>(`/conversations/${conversationId}`),

    updateStatus: (conversationId: string, status: ConversationStatus) =>
      request<Conversation>(`/conversations/${conversationId}/status`, {
        method: "PATCH",
        body: { status },
      }),

    assign: (conversationId: string, agentId: string | null) =>
      request<Conversation>(`/conversations/${conversationId}/assign`, {
        method: "PATCH",
        body: { agent_id: agentId },
      }),
  },

  messages: {
    list: (conversationId: string) =>
      request<{ messages: Message[] }>(
        `/conversations/${conversationId}/messages`,
      ),

    send: (
      conversationId: string,
      input: { body: string; kind?: MessageKind },
    ) =>
      request<Message>(`/conversations/${conversationId}/messages`, {
        method: "POST",
        body: input,
      }),
  },

  notes: {
    list: (conversationId: string) =>
      request<{ notes: InternalNote[] }>(
        `/conversations/${conversationId}/notes`,
      ),

    create: (conversationId: string, body: string) =>
      request<InternalNote>(`/conversations/${conversationId}/notes`, {
        method: "POST",
        body: { body },
      }),
  },

  contacts: {
    list: (
      workspaceId: string,
      params: {
        search?: string;
        channel?: ChannelType;
        tag?: string;
        created_after?: string;
        limit?: number;
        offset?: number;
      } = {},
    ) => {
      const qs = new URLSearchParams();
      if (params.search) qs.set("search", params.search);
      if (params.channel) qs.set("channel", params.channel);
      if (params.tag) qs.set("tag", params.tag);
      if (params.created_after) qs.set("created_after", params.created_after);
      if (params.limit) qs.set("limit", String(params.limit));
      if (params.offset) qs.set("offset", String(params.offset));
      const q = qs.toString();
      return request<{ contacts: Contact[] }>(
        `/workspaces/${workspaceId}/contacts${q ? `?${q}` : ""}`,
      );
    },

    create: (
      workspaceId: string,
      input: {
        name: string;
        phone?: string | null;
        email?: string | null;
        location?: string | null;
        company?: string | null;
        birthday?: string | null;
        notes?: string | null;
        tag_ids?: string[];
      },
    ) =>
      request<Contact>(`/workspaces/${workspaceId}/contacts`, {
        method: "POST",
        body: input,
      }),

    get: (contactId: string) =>
      request<ContactDetail>(`/contacts/${contactId}`),

    update: (
      contactId: string,
      input: {
        name: string;
        phone?: string | null;
        email?: string | null;
        location?: string | null;
        company?: string | null;
        birthday?: string | null;
        notes?: string | null;
      },
    ) =>
      request<Contact>(`/contacts/${contactId}`, {
        method: "PATCH",
        body: input,
      }),

    remove: (contactId: string) =>
      request<void>(`/contacts/${contactId}`, { method: "DELETE" }),

    attachTag: (contactId: string, tagId: string) =>
      request<void>(`/contacts/${contactId}/tags`, {
        method: "POST",
        body: { tag_id: tagId },
      }),

    detachTag: (contactId: string, tagId: string) =>
      request<void>(`/contacts/${contactId}/tags/${tagId}`, {
        method: "DELETE",
      }),

    merge: (contactId: string, targetId: string) =>
      request<Contact>(`/contacts/${contactId}/merge`, {
        method: "POST",
        body: { target_id: targetId },
      }),

    duplicates: (workspaceId: string) =>
      request<{ contacts: Contact[] }>(
        `/workspaces/${workspaceId}/contacts/duplicates`,
      ),

    importCSV: async (workspaceId: string, file: File) => {
      const token = getAccessToken();
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(
        `${API_URL}/workspaces/${workspaceId}/contacts/import`,
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        },
      );
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new ApiException(
          res.status,
          payload?.message ?? "Gagal mengimport",
          payload?.details,
        );
      }
      return payload as ContactImportResult;
    },

    exportCSVUrl: (workspaceId: string) =>
      `${API_URL}/workspaces/${workspaceId}/contacts/export`,
  },

  tags: {
    list: (workspaceId: string) =>
      request<{ tags: Tag[] }>(`/workspaces/${workspaceId}/tags`),

    create: (workspaceId: string, input: { name: string; color?: string }) =>
      request<Tag>(`/workspaces/${workspaceId}/tags`, {
        method: "POST",
        body: input,
      }),

    remove: (workspaceId: string, tagId: string) =>
      request<void>(`/workspaces/${workspaceId}/tags/${tagId}`, {
        method: "DELETE",
      }),
  },

  broadcasts: {
    list: (workspaceId: string) =>
      request<{ broadcasts: BroadcastCampaign[] }>(
        `/workspaces/${workspaceId}/broadcasts`,
      ),

    create: (
      workspaceId: string,
      input: {
        name: string;
        channel_id: string;
        template_id?: string;
        audience_kind: AudienceKind;
        audience_filter?: AudienceFilter;
        body_override?: string;
        variables?: Record<string, string>;
        rate_per_minute?: number;
      },
    ) =>
      request<BroadcastCampaign>(
        `/workspaces/${workspaceId}/broadcasts`,
        { method: "POST", body: input },
      ),

    get: (workspaceId: string, campaignId: string) =>
      request<BroadcastDetail>(
        `/workspaces/${workspaceId}/broadcasts/${campaignId}`,
      ),

    schedule: (
      workspaceId: string,
      campaignId: string,
      input: { scheduled_at: string; launch?: boolean },
    ) =>
      request<BroadcastCampaign>(
        `/workspaces/${workspaceId}/broadcasts/${campaignId}/schedule`,
        { method: "POST", body: input },
      ),

    cancel: (workspaceId: string, campaignId: string) =>
      request<BroadcastCampaign>(
        `/workspaces/${workspaceId}/broadcasts/${campaignId}/cancel`,
        { method: "POST" },
      ),
  },

  whatsapp: {
    info: (workspaceId: string) =>
      request<{ webhook_url: string; setup_doc: string }>(
        `/workspaces/${workspaceId}/channels/whatsapp`,
      ),

    connect: (
      workspaceId: string,
      input: {
        name: string;
        phone_number_id: string;
        business_account_id?: string;
        access_token: string;
        webhook_verify_token?: string;
      },
    ) =>
      request<{ channel: Channel; webhook_url: string }>(
        `/workspaces/${workspaceId}/channels/whatsapp/connect`,
        { method: "POST", body: input },
      ),

    send: (input: {
      channel_id: string;
      conversation_id: string;
      body: string;
    }) =>
      request<Message>("/channels/whatsapp/send", {
        method: "POST",
        body: input,
      }),
  },

  instagram: {
    info: (workspaceId: string) =>
      request<{ webhook_url: string; setup_doc: string }>(
        `/workspaces/${workspaceId}/channels/instagram`,
      ),

    connect: (
      workspaceId: string,
      input: {
        name: string;
        instagram_business_id: string;
        page_id?: string;
        page_access_token: string;
        webhook_verify_token?: string;
      },
    ) =>
      request<{ channel: Channel; webhook_url: string }>(
        `/workspaces/${workspaceId}/channels/instagram/connect`,
        { method: "POST", body: input },
      ),

    send: (input: {
      channel_id?: string;
      conversation_id: string;
      body: string;
    }) =>
      request<Message>("/channels/instagram/send", {
        method: "POST",
        body: input,
      }),
  },

  quickReplies: {
    list: (workspaceId: string) =>
      request<{ quick_replies: QuickReply[] }>(
        `/workspaces/${workspaceId}/quick-replies`,
      ),

    create: (workspaceId: string, input: { shortcut: string; body: string }) =>
      request<QuickReply>(`/workspaces/${workspaceId}/quick-replies`, {
        method: "POST",
        body: input,
      }),

    update: (
      workspaceId: string,
      replyId: string,
      input: { shortcut: string; body: string },
    ) =>
      request<QuickReply>(
        `/workspaces/${workspaceId}/quick-replies/${replyId}`,
        { method: "PATCH", body: input },
      ),

    remove: (workspaceId: string, replyId: string) =>
      request<void>(
        `/workspaces/${workspaceId}/quick-replies/${replyId}`,
        { method: "DELETE" },
      ),
  },

  templates: {
    list: (workspaceId: string) =>
      request<{ templates: MessageTemplate[] }>(
        `/workspaces/${workspaceId}/templates`,
      ),

    create: (
      workspaceId: string,
      input: {
        name: string;
        category: TemplateCategory;
        language?: string;
        header_kind?: string;
        header_content?: string;
        body: string;
        footer?: string;
        buttons?: TemplateButton[];
        variables?: {
          name: string;
          label?: string;
          sample_value?: string;
        }[];
      },
    ) =>
      request<TemplateWithVariables>(`/workspaces/${workspaceId}/templates`, {
        method: "POST",
        body: input,
      }),

    get: (workspaceId: string, templateId: string) =>
      request<TemplateWithVariables>(
        `/workspaces/${workspaceId}/templates/${templateId}`,
      ),

    update: (
      workspaceId: string,
      templateId: string,
      input: {
        name: string;
        category: TemplateCategory;
        language?: string;
        header_kind?: string;
        header_content?: string;
        body: string;
        footer?: string;
        buttons?: TemplateButton[];
        variables?: {
          name: string;
          label?: string;
          sample_value?: string;
        }[];
      },
    ) =>
      request<TemplateWithVariables>(
        `/workspaces/${workspaceId}/templates/${templateId}`,
        { method: "PATCH", body: input },
      ),

    remove: (workspaceId: string, templateId: string) =>
      request<void>(`/workspaces/${workspaceId}/templates/${templateId}`, {
        method: "DELETE",
      }),

    submit: (workspaceId: string, templateId: string) =>
      request<MessageTemplate>(
        `/workspaces/${workspaceId}/templates/${templateId}/submit`,
        { method: "POST" },
      ),

    use: (
      workspaceId: string,
      templateId: string,
      input: { conversation_id?: string; variables: Record<string, string> },
    ) =>
      request<{ template_id: string; body: string; footer: string | null }>(
        `/workspaces/${workspaceId}/templates/${templateId}/use`,
        { method: "POST", body: input },
      ),
  },

  interactives: {
    list: (workspaceId: string) =>
      request<{ interactive_messages: InteractiveMessage[] }>(
        `/workspaces/${workspaceId}/interactive-messages`,
      ),

    create: (
      workspaceId: string,
      input: { name: string; kind: InteractiveKind; payload: InteractivePayload },
    ) =>
      request<InteractiveMessage>(
        `/workspaces/${workspaceId}/interactive-messages`,
        { method: "POST", body: input },
      ),

    update: (
      workspaceId: string,
      id: string,
      input: { name: string; payload: InteractivePayload },
    ) =>
      request<InteractiveMessage>(
        `/workspaces/${workspaceId}/interactive-messages/${id}`,
        { method: "PATCH", body: input },
      ),

    remove: (workspaceId: string, id: string) =>
      request<void>(
        `/workspaces/${workspaceId}/interactive-messages/${id}`,
        { method: "DELETE" },
      ),
  },

  messenger: {
    info: (workspaceId: string) =>
      request<{ webhook_url: string; setup_doc: string }>(
        `/workspaces/${workspaceId}/channels/messenger`,
      ),

    connect: (
      workspaceId: string,
      input: {
        name: string;
        page_id: string;
        page_access_token: string;
        webhook_verify_token?: string;
      },
    ) =>
      request<{ channel: Channel; webhook_url: string }>(
        `/workspaces/${workspaceId}/channels/messenger/connect`,
        { method: "POST", body: input },
      ),

    send: (input: {
      channel_id?: string;
      conversation_id: string;
      body: string;
    }) =>
      request<Message>("/channels/messenger/send", {
        method: "POST",
        body: input,
      }),
  },

  aiAgent: {
    get: (workspaceId: string) =>
      request<AIAgent>(`/workspaces/${workspaceId}/ai-agent`),

    update: (
      workspaceId: string,
      input: {
        name: string;
        tone: string;
        language: string;
        system_prompt: string;
        fallback_message: string;
        confidence_threshold: number;
        enabled: boolean;
        enabled_channel_ids: string[];
        handoff_enabled: boolean;
        model: string;
        embedding_model: string;
      },
    ) =>
      request<AIAgent>(`/workspaces/${workspaceId}/ai-agent`, {
        method: "PATCH",
        body: input,
      }),

    approve: (workspaceId: string, notes?: string) =>
      request<AIAgent>(`/workspaces/${workspaceId}/ai-agent/approve`, {
        method: "POST",
        body: { notes: notes ?? null },
      }),

    reject: (workspaceId: string, notes?: string) =>
      request<void>(`/workspaces/${workspaceId}/ai-agent/reject`, {
        method: "POST",
        body: { notes: notes ?? null },
      }),

    reviews: (workspaceId: string) =>
      request<{ reviews: AIPromptReview[] }>(
        `/workspaces/${workspaceId}/ai-agent/reviews`,
      ),
  },

  knowledge: {
    list: (workspaceId: string) =>
      request<{ documents: KnowledgeDocument[] }>(
        `/workspaces/${workspaceId}/knowledge`,
      ),

    create: (
      workspaceId: string,
      input: {
        title: string;
        source_kind: "manual" | "url";
        source_url?: string;
        content: string;
      },
    ) =>
      request<KnowledgeDocument>(`/workspaces/${workspaceId}/knowledge`, {
        method: "POST",
        body: input,
      }),

    upload: async (workspaceId: string, file: File, title?: string) => {
      const token = getAccessToken();
      const fd = new FormData();
      fd.append("file", file);
      if (title) fd.append("title", title);
      const res = await fetch(
        `${API_URL}/workspaces/${workspaceId}/knowledge/upload`,
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        },
      );
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new ApiException(
          res.status,
          payload?.message ?? "Gagal mengunggah dokumen",
          payload?.details,
        );
      }
      return payload as KnowledgeDocument;
    },

    search: (workspaceId: string, q: string, limit = 4) =>
      request<{ results: KnowledgeSearchResult[] }>(
        `/workspaces/${workspaceId}/knowledge/search?q=${encodeURIComponent(q)}&limit=${limit}`,
      ),

    remove: (workspaceId: string, docId: string) =>
      request<void>(`/workspaces/${workspaceId}/knowledge/${docId}`, {
        method: "DELETE",
      }),
  },

  ai: {
    playground: (
      workspaceId: string,
      input: { message: string; system_prompt?: string },
    ) =>
      request<PlaygroundResult>(`/workspaces/${workspaceId}/ai/playground`, {
        method: "POST",
        body: input,
      }),

    logs: (workspaceId: string) =>
      request<{ logs: BotReplyLog[] }>(`/workspaces/${workspaceId}/ai/logs`),
  },

  apiKeys: {
    list: (workspaceId: string) =>
      request<{ api_keys: APIKey[] }>(`/workspaces/${workspaceId}/api-keys`),

    create: (workspaceId: string, input: { name: string; scopes?: string[] }) =>
      request<CreatedAPIKey>(`/workspaces/${workspaceId}/api-keys`, {
        method: "POST",
        body: input,
      }),

    usage: (workspaceId: string, limit = 100) =>
      request<{ logs: APIUsageLog[] }>(
        `/workspaces/${workspaceId}/api-keys/usage?limit=${limit}`,
      ),

    revoke: (keyId: string) =>
      request<void>(`/api-keys/${keyId}`, { method: "DELETE" }),
  },

  admin: {
    overview: () => request<PlatformOverview>(`/admin/overview`),

    users: (search = "") =>
      request<{ users: AdminUserListItem[] }>(
        `/admin/users${search ? `?search=${encodeURIComponent(search)}` : ""}`,
      ),

    workspaces: (search = "") =>
      request<{ workspaces: AdminWorkspaceListItem[] }>(
        `/admin/workspaces${search ? `?search=${encodeURIComponent(search)}` : ""}`,
      ),

    subscriptions: () =>
      request<{ subscriptions: AdminSubscriptionListItem[] }>(
        `/admin/subscriptions`,
      ),

    channels: () =>
      request<{ channels: AdminChannelListItem[] }>(`/admin/channels`),

    systemLogs: (level = "") =>
      request<{ system_logs: SystemLog[] }>(
        `/admin/logs${level ? `?level=${level}` : ""}`,
      ),

    webhookLogs: () =>
      request<{ webhook_logs: WebhookDeliveryLog[] }>(`/admin/logs?type=webhook`),

    auditLogs: () =>
      request<{ audit_logs: AdminAuditLog[] }>(`/admin/audit-logs`),

    reports: (status = "") =>
      request<{ reports: AbuseReport[] }>(
        `/admin/reports${status ? `?status=${status}` : ""}`,
      ),

    suspend: (workspaceId: string, suspended: boolean, reason?: string) =>
      request<Workspace>(`/admin/workspaces/${workspaceId}/suspend`, {
        method: "POST",
        body: { suspended, reason: reason ?? "" },
      }),

    resolveReport: (reportId: string, status: string, note?: string) =>
      request<AbuseReport>(`/admin/reports/${reportId}/resolve`, {
        method: "POST",
        body: { status, note: note ?? "" },
      }),

    impersonate: (userId: string) =>
      request<ImpersonateResult>(`/admin/users/${userId}/impersonate`, {
        method: "POST",
      }),
  },

  billing: {
    plans: () => request<{ plans: SaasPlan[] }>(`/plans`, { auth: false }),

    get: (workspaceId: string) =>
      request<BillingSummary>(`/workspaces/${workspaceId}/billing`),

    changePlan: (workspaceId: string, planCode: string) =>
      request<ChangePlanResult>(
        `/workspaces/${workspaceId}/billing/change-plan`,
        { method: "POST", body: { plan_code: planCode } },
      ),

    usage: (workspaceId: string) =>
      request<UsageSummary>(`/workspaces/${workspaceId}/usage`),

    invoices: (workspaceId: string) =>
      request<{ invoices: Invoice[] }>(`/workspaces/${workspaceId}/invoices`),
  },

  webhooks: {
    events: () => request<{ events: string[] }>(`/webhook-events`),

    list: (workspaceId: string) =>
      request<{ endpoints: WebhookEndpoint[] }>(
        `/workspaces/${workspaceId}/webhook-endpoints`,
      ),

    create: (
      workspaceId: string,
      input: {
        name: string;
        url: string;
        events: string[];
        enabled?: boolean;
        headers?: Record<string, string>;
      },
    ) =>
      request<WebhookEndpoint>(
        `/workspaces/${workspaceId}/webhook-endpoints`,
        { method: "POST", body: input },
      ),

    update: (
      endpointId: string,
      input: {
        name: string;
        url: string;
        events: string[];
        enabled?: boolean;
        headers?: Record<string, string>;
      },
    ) =>
      request<WebhookEndpoint>(`/webhook-endpoints/${endpointId}`, {
        method: "PATCH",
        body: input,
      }),

    remove: (endpointId: string) =>
      request<void>(`/webhook-endpoints/${endpointId}`, { method: "DELETE" }),

    rotateSecret: (endpointId: string) =>
      request<WebhookEndpoint>(
        `/webhook-endpoints/${endpointId}/rotate-secret`,
        { method: "POST" },
      ),

    test: (endpointId: string) =>
      request<{ queued: boolean }>(`/webhook-endpoints/${endpointId}/test`, {
        method: "POST",
      }),

    deliveries: (endpointId: string, limit = 50) =>
      request<{ deliveries: WebhookDeliveryLog[] }>(
        `/webhook-endpoints/${endpointId}/deliveries?limit=${limit}`,
      ),
  },

  segments: {
    list: (workspaceId: string) =>
      request<{ segments: SegmentWithRules[] }>(
        `/workspaces/${workspaceId}/segments`,
      ),

    create: (
      workspaceId: string,
      input: {
        name: string;
        description?: string | null;
        color?: string;
        rules: { field: string; operator: string; value: string }[];
      },
    ) =>
      request<SegmentWithRules>(`/workspaces/${workspaceId}/segments`, {
        method: "POST",
        body: input,
      }),

    get: (workspaceId: string, segmentId: string) =>
      request<{ segment: SegmentWithRules; members: Contact[] }>(
        `/workspaces/${workspaceId}/segments/${segmentId}`,
      ),

    remove: (workspaceId: string, segmentId: string) =>
      request<void>(`/workspaces/${workspaceId}/segments/${segmentId}`, {
        method: "DELETE",
      }),
  },
};
