/**
 * Shared types & constants between the Next.js web app and (conceptually)
 * the Go services. The Go side mirrors these in `internal/models`.
 */

/* ------------------------------- Roles --------------------------------- */

export type MemberRole = "OWNER" | "ADMIN" | "AGENT" | "VIEWER";

export const MEMBER_ROLES: MemberRole[] = ["OWNER", "ADMIN", "AGENT", "VIEWER"];

/** Roles that can be assigned when inviting a new member. */
export const INVITABLE_ROLES: MemberRole[] = ["ADMIN", "AGENT", "VIEWER"];

/** Role weight — higher number means more privileges. */
export const ROLE_WEIGHT: Record<MemberRole, number> = {
  OWNER: 80,
  ADMIN: 60,
  AGENT: 40,
  VIEWER: 20,
};

export function hasRoleAtLeast(role: MemberRole, minimum: MemberRole): boolean {
  return ROLE_WEIGHT[role] >= ROLE_WEIGHT[minimum];
}

/* ------------------------------- User ---------------------------------- */

export interface User {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  is_active: boolean;
  is_super_admin: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface AuthResponse extends AuthTokens {
  user: User;
}

export interface ApiError {
  error: string;
  message: string;
  details?: Record<string, string>;
}

/* ----------------------------- Workspace ------------------------------- */

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  brand_color: string;
  timezone: string;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

/** A workspace annotated with the current user's role in it. */
export interface WorkspaceWithRole extends Workspace {
  member_role: MemberRole;
}

export type MemberStatus = "active" | "invited" | "suspended";

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: MemberRole;
  status: MemberStatus;
  invited_by: string | null;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
  user_name: string;
  user_email: string;
  user_avatar_url: string | null;
}

export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export interface WorkspaceInvitation {
  id: string;
  workspace_id: string;
  email: string;
  role: MemberRole;
  token: string;
  status: InvitationStatus;
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamListing {
  members: WorkspaceMember[];
  invitations: WorkspaceInvitation[];
}

/* ------------------------------ Channels ------------------------------- */

export type ChannelType = "whatsapp" | "instagram" | "messenger";

export type ChannelStatus =
  | "disconnected"
  | "pending"
  | "connected"
  | "error";

export interface Channel {
  id: string;
  workspace_id: string;
  type: ChannelType;
  name: string;
  status: ChannelStatus;
  external_id: string | null;
  error_message: string | null;
  last_connected_at: string | null;
  has_credentials: boolean;
  created_at: string;
  updated_at: string;
}

export const CHANNEL_LABELS: Record<ChannelType, string> = {
  whatsapp: "WhatsApp Business API",
  instagram: "Instagram DM",
  messenger: "Facebook Messenger",
};

/* ------------------------------- Inbox --------------------------------- */

export type ConversationStatus = "open" | "pending" | "resolved" | "spam";

export const CONVERSATION_STATUSES: ConversationStatus[] = [
  "open",
  "pending",
  "resolved",
  "spam",
];

export type MessageDirection = "inbound" | "outbound";

export type MessageStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

export type MessageKind =
  | "text"
  | "image"
  | "file"
  | "audio"
  | "video"
  | "system";

export interface Contact {
  id: string;
  workspace_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  external_source: ChannelType | null;
  external_id: string | null;
  metadata: Record<string, unknown>;
  location: string | null;
  company: string | null;
  birthday: string | null;
  notes: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactActivity {
  id: string;
  contact_id: string;
  workspace_id: string;
  actor_id: string | null;
  actor_name: string | null;
  kind: string;
  body: string | null;
  metadata: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
}

export interface ContactMessage extends Message {
  channel_type: ChannelType;
}

export interface ContactDetail {
  contact: Contact;
  tags: Tag[];
  activities: ContactActivity[];
  messages: ContactMessage[];
}

export interface ContactImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

/* ----------------------------- Segments -------------------------------- */

export interface Segment {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  color: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SegmentRule {
  id: string;
  segment_id: string;
  field: string;
  operator: string;
  value: string;
  created_at: string;
}

export interface SegmentWithRules extends Segment {
  rules: SegmentRule[];
  member_count: number;
}

export const SEGMENT_FIELDS: { key: string; label: string }[] = [
  { key: "name", label: "Nama" },
  { key: "phone", label: "Telepon" },
  { key: "email", label: "Email" },
  { key: "location", label: "Lokasi" },
  { key: "company", label: "Perusahaan" },
  { key: "channel", label: "Source channel" },
  { key: "tag", label: "Tag" },
];

export const SEGMENT_OPERATORS: { key: string; label: string }[] = [
  { key: "equals", label: "sama dengan" },
  { key: "contains", label: "mengandung" },
];

export interface Tag {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  workspace_id: string;
  channel_id: string;
  contact_id: string;
  status: ConversationStatus;
  assigned_agent_id: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export interface ConversationListItem extends Conversation {
  contact_name: string;
  contact_avatar_url: string | null;
  channel_type: ChannelType;
  channel_name: string;
}

export interface ConversationDetail {
  conversation: Conversation;
  contact: Contact | null;
  tags: Tag[];
}

export interface Message {
  id: string;
  conversation_id: string;
  workspace_id: string;
  direction: MessageDirection;
  kind: MessageKind;
  body: string | null;
  status: MessageStatus;
  sender_user_id: string | null;
  external_id: string | null;
  created_at: string;
}

export interface InternalNote {
  id: string;
  conversation_id: string;
  author_id: string | null;
  author_name: string | null;
  author_email: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

/* ----------------------------- WS Events ------------------------------- */

export type InboxEventType =
  | "message.new"
  | "message.updated"
  | "conversation.updated"
  | "conversation.assigned"
  | "note.new"
  | "presence.update"
  | "typing";

export interface InboxEvent<T = unknown> {
  type: InboxEventType;
  workspace_id: string;
  payload: T;
}

export interface TypingPayload {
  user_id: string;
  conversation_id: string;
}

export interface PresencePayload {
  user_id: string;
  status: string;
}

/* ----------------------- Templates / Quick replies --------------------- */

export type TemplateCategory = "marketing" | "utility" | "authentication";

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  "marketing",
  "utility",
  "authentication",
];

export type TemplateStatus = "draft" | "pending" | "approved" | "rejected";

export type TemplateButton =
  | { type: "reply"; text: string }
  | { type: "url"; text: string; url: string }
  | { type: "phone"; text: string; phone: string };

export interface MessageTemplate {
  id: string;
  workspace_id: string;
  name: string;
  category: TemplateCategory;
  status: TemplateStatus;
  language: string;
  header_kind: string | null;
  header_content: string | null;
  body: string;
  footer: string | null;
  buttons: TemplateButton[];
  external_id: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateVariable {
  id: string;
  template_id: string;
  name: string;
  label: string | null;
  sample_value: string | null;
  position: number;
  created_at: string;
}

export interface TemplateWithVariables extends MessageTemplate {
  variables: TemplateVariable[];
}

export interface QuickReply {
  id: string;
  workspace_id: string;
  shortcut: string;
  body: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type InteractiveKind = "reply_buttons" | "list" | "carousel";

export interface ReplyButtonsPayload {
  body: string;
  buttons: { id: string; title: string }[];
}

export interface ListPayload {
  body: string;
  button_text: string;
  sections: {
    title: string;
    rows: { id: string; title: string; description?: string }[];
  }[];
}

export interface CarouselPayload {
  cards: {
    image_url: string;
    title: string;
    subtitle?: string;
    button?: { type: "url" | "reply"; text: string; url?: string };
  }[];
}

export type InteractivePayload =
  | ReplyButtonsPayload
  | ListPayload
  | CarouselPayload
  | Record<string, unknown>;

export interface InteractiveMessage {
  id: string;
  workspace_id: string;
  name: string;
  kind: InteractiveKind;
  payload: InteractivePayload;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/* ----------------------------- Broadcast ------------------------------- */

export type BroadcastStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "completed"
  | "failed"
  | "cancelled";

export type RecipientStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "skipped";

export type AudienceKind = "all" | "tag" | "segment" | "csv";

export interface AudienceFilter {
  tag_id?: string;
  segment_id?: string;
  csv_rows?: {
    name?: string;
    phone?: string;
    external_id?: string;
    variables?: Record<string, string>;
  }[];
}

export interface BroadcastCampaign {
  id: string;
  workspace_id: string;
  channel_id: string;
  template_id: string | null;
  name: string;
  audience_kind: AudienceKind;
  audience_filter: AudienceFilter;
  body_override: string | null;
  variables: Record<string, string>;
  status: BroadcastStatus;
  rate_per_minute: number;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  reply_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BroadcastRecipient {
  id: string;
  campaign_id: string;
  workspace_id: string;
  contact_id: string | null;
  name: string | null;
  phone: string | null;
  external_id: string | null;
  variables: Record<string, string>;
  rendered_body: string | null;
  status: RecipientStatus;
  message_id: string | null;
  external_message_id: string | null;
  attempts: number;
  last_error: string | null;
  enqueued_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
  created_at: string;
}

export interface BroadcastLog {
  id: string;
  campaign_id: string;
  recipient_id: string | null;
  event: string;
  detail: string | null;
  occurred_at: string;
}

export interface BroadcastDetail {
  campaign: BroadcastCampaign;
  recipients: BroadcastRecipient[];
  logs: BroadcastLog[];
}

/* ----------------------------- AI / Bot -------------------------------- */

export interface AIAgent {
  id: string;
  workspace_id: string;
  name: string;
  tone: string;
  language: string;
  system_prompt: string;
  fallback_message: string;
  confidence_threshold: number;
  enabled: boolean;
  enabled_channel_ids: string[] | null;
  handoff_enabled: boolean;
  model: string;
  embedding_model: string;
  prompt_approved: boolean;
  created_at: string;
  updated_at: string;
}

export type KnowledgeSource = "upload" | "manual" | "url";
export type KnowledgeStatus = "processing" | "ready" | "failed";

export interface KnowledgeDocument {
  id: string;
  workspace_id: string;
  title: string;
  source_kind: KnowledgeSource;
  source_url: string | null;
  mime_type: string | null;
  raw_content?: string | null;
  status: KnowledgeStatus;
  chunk_count: number;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeSearchResult {
  chunk_id: string;
  document_id: string;
  position: number;
  content: string;
  score: number;
}

export interface BotReplyLog {
  id: string;
  workspace_id: string;
  conversation_id: string | null;
  inbound_message_id: string | null;
  reply_message_id: string | null;
  inbound_text: string | null;
  response_text: string | null;
  confidence: number;
  handed_off: boolean;
  chunk_ids: string[];
  model: string | null;
  error_message: string | null;
  created_at: string;
}

export type PromptReviewStatus = "pending" | "approved" | "rejected";

export interface AIPromptReview {
  id: string;
  ai_agent_id: string;
  workspace_id: string;
  prompt: string;
  reviewer_id: string | null;
  status: PromptReviewStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlaygroundResult {
  response: string;
  confidence: number;
  model: string;
  chunks: KnowledgeSearchResult[];
  would_handoff: boolean;
  fallback?: string;
}

/* --------------------- Developer API + Webhooks ------------------------ */

export interface APIKey {
  id: string;
  workspace_id: string;
  name: string;
  prefix: string;
  scopes: string[];
  created_by: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Returned only at creation — `plaintext` is shown exactly once. */
export interface CreatedAPIKey {
  key: APIKey;
  plaintext: string;
}

export interface APIUsageLog {
  id: string;
  workspace_id: string;
  api_key_id: string | null;
  method: string;
  path: string;
  status_code: number;
  latency_ms: number;
  ip: string | null;
  user_agent: string | null;
  error_message: string | null;
  created_at: string;
}

export type WebhookEvent =
  | "message.received"
  | "message.sent"
  | "message.delivered"
  | "conversation.created"
  | "conversation.resolved"
  | "contact.created"
  | "broadcast.completed";

export const WEBHOOK_EVENTS: WebhookEvent[] = [
  "message.received",
  "message.sent",
  "message.delivered",
  "conversation.created",
  "conversation.resolved",
  "contact.created",
  "broadcast.completed",
];

export interface WebhookEndpoint {
  id: string;
  workspace_id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
  headers: Record<string, string>;
  created_by: string | null;
  last_delivery_at: string | null;
  last_status: number | null;
  failure_count: number;
  created_at: string;
  updated_at: string;
}

export interface WebhookDeliveryLog {
  id: string;
  workspace_id: string;
  webhook_endpoint_id: string;
  event: string;
  payload: unknown;
  status_code: number | null;
  attempt: number;
  succeeded: boolean;
  response_body: string | null;
  error_message: string | null;
  duration_ms: number;
  created_at: string;
}

/* ------------------------------ Billing -------------------------------- */

export interface PlanLimits {
  team_members: number;
  knowledge_documents: number;
  whatsapp_numbers: number;
  message_history_days: number;
  api_access: boolean;
  n8n_integration: boolean;
  ai_chatbot: boolean;
}

export interface SaasPlan {
  id: string;
  code: string;
  name: string;
  description: string;
  price_idr: number;
  billing_period: string;
  features: string[];
  limits: PlanLimits;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type SubscriptionStatus = "trial" | "active" | "past_due" | "cancelled";

export interface SaasSubscription {
  id: string;
  workspace_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  trial_ends_at: string | null;
  current_period_start: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export interface BillingSummary {
  subscription: SaasSubscription;
  plan: SaasPlan;
}

export interface UsageMetric {
  metric: string;
  label: string;
  used: number;
  limit: number; // -1 = unlimited, 0 = unavailable
  unlimited: boolean;
}

export interface UsageSummary {
  plan_code: string;
  metrics: UsageMetric[];
}

export type InvoiceStatus = "draft" | "open" | "paid" | "void";

export interface Invoice {
  id: string;
  workspace_id: string;
  subscription_id: string | null;
  number: string;
  amount_idr: number;
  status: InvoiceStatus;
  period_start: string | null;
  period_end: string | null;
  paid_at: string | null;
  payment_provider: string | null;
  payment_ref: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentTransaction {
  order_id: string;
  transaction_id: string;
  snap_token: string;
  redirect_url: string;
  gross_amount: number;
  status: string;
  is_placeholder: boolean;
  created_at: string;
}

export interface ChangePlanResult {
  billing: BillingSummary;
  invoice?: Invoice;
  payment?: PaymentTransaction;
}

/* ---------------------------- Super Admin ------------------------------ */

export interface PlatformPlanCount {
  plan_code: string;
  count: number;
}

export interface AdminUserListItem {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  is_active: boolean;
  is_super_admin: boolean;
  workspace_count: number;
  last_login_at: string | null;
  created_at: string;
}

export interface PlatformOverview {
  total_workspaces: number;
  suspended_workspaces: number;
  total_users: number;
  total_messages: number;
  total_active_channels: number;
  revenue_idr: number;
  open_reports: number;
  plan_breakdown: PlatformPlanCount[];
  recent_signups: AdminUserListItem[];
}

export interface AdminWorkspaceListItem {
  id: string;
  name: string;
  slug: string;
  owner_email: string | null;
  member_count: number;
  channel_count: number;
  plan_code: string | null;
  subscription_status: string | null;
  suspended_at: string | null;
  created_at: string;
}

export interface AdminSubscriptionListItem {
  id: string;
  workspace_id: string;
  workspace_name: string;
  plan_code: string;
  plan_name: string;
  price_idr: number;
  status: string;
  current_period_end: string | null;
  created_at: string;
}

export interface AdminChannelListItem {
  id: string;
  workspace_id: string;
  workspace_name: string;
  type: string;
  name: string;
  status: string;
  external_id: string | null;
  has_credentials: boolean;
  last_connected_at: string | null;
  created_at: string;
}

export type SystemLogLevel = "debug" | "info" | "warn" | "error";

export interface SystemLog {
  id: string;
  level: SystemLogLevel;
  source: string;
  message: string;
  context: unknown;
  workspace_id: string | null;
  created_at: string;
}

export interface AdminAuditLog {
  id: string;
  actor_user_id: string | null;
  actor_email: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata: unknown;
  ip: string | null;
  created_at: string;
}

export type AbuseStatus = "open" | "reviewing" | "resolved" | "dismissed";

export interface AbuseReport {
  id: string;
  workspace_id: string | null;
  workspace_name?: string | null;
  reporter_user_id: string | null;
  reporter_email: string | null;
  category: string;
  description: string;
  status: AbuseStatus;
  resolution_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImpersonateResult {
  target_user_id: string;
  target_email: string;
  placeholder: boolean;
  impersonate_ref: string;
  note: string;
}

/* ----------------------------- Dashboard ------------------------------- */

export interface DashboardOverview {
  total_contacts: number;
  new_contacts: number;
  total_conversations: number;
  open_conversations: number;
  pending_conversations: number;
  resolved_today: number;
  active_agents: number;
  connected_channels: number;
  avg_response_seconds: number;
  total_messages: number;
  inbound_messages: number;
  outbound_messages: number;
  resolution_rate: number;
  messages_delta: number;
  conversations_delta: number;
  contacts_delta: number;
  messages_series: { label: string; inbound: number; outbound: number }[];
  channel_breakdown: { channel: string; value: number }[];
  status_breakdown: { status: string; value: number }[];
  response_series: { label: string; seconds: number }[];
  hourly_activity: { hour: string; total: number }[];
  recent_conversations: {
    id: string;
    contact_name: string;
    channel_type: ChannelType;
    channel_name: string;
    preview: string | null;
    status: ConversationStatus;
    unread_count: number;
    last_message_at: string | null;
  }[];
}
