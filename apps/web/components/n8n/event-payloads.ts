import { WEBHOOK_EVENTS, type WebhookEvent } from "@aichat/shared";

function envelope(event: WebhookEvent, data: Record<string, unknown>): string {
  return JSON.stringify(
    {
      id: "5f9b1c2e-...",
      event,
      workspace_id: "8a2b...",
      occurred_at: "2026-05-21T08:30:00Z",
      data,
    },
    null,
    2,
  );
}

const MESSAGE = {
  id: "msg-uuid",
  conversation_id: "conv-uuid",
  direction: "inbound",
  kind: "text",
  body: "Halo, saya mau tanya produk",
  status: "delivered",
  created_at: "2026-05-21T08:30:00Z",
};

const CONVERSATION = {
  id: "conv-uuid",
  contact_id: "ct-uuid",
  channel_type: "whatsapp",
  status: "open",
  last_message_at: "2026-05-21T08:30:00Z",
};

const CONTACT = {
  id: "ct-uuid",
  name: "Budi Santoso",
  phone: "6281234567890",
  email: "budi@mail.com",
  created_at: "2026-05-21T08:30:00Z",
};

const BROADCAST = {
  id: "bc-uuid",
  name: "Promo Lebaran 2026",
  total_recipients: 1200,
  sent_count: 1180,
  failed_count: 20,
  completed_at: "2026-05-21T09:00:00Z",
};

export const EVENT_PAYLOADS: Record<WebhookEvent, string> = {
  "message.received": envelope("message.received", MESSAGE),
  "message.sent": envelope("message.sent", {
    ...MESSAGE,
    direction: "outbound",
    body: "Tentu, ada yang bisa kami bantu?",
    status: "sent",
  }),
  "message.delivered": envelope("message.delivered", {
    ...MESSAGE,
    direction: "outbound",
    status: "read",
  }),
  "conversation.created": envelope("conversation.created", CONVERSATION),
  "conversation.resolved": envelope("conversation.resolved", {
    ...CONVERSATION,
    status: "resolved",
  }),
  "contact.created": envelope("contact.created", CONTACT),
  "broadcast.completed": envelope("broadcast.completed", BROADCAST),
};

export const EVENT_LABELS: Record<WebhookEvent, string> = {
  "message.received": "Pesan masuk dari pelanggan",
  "message.sent": "Pesan keluar terkirim",
  "message.delivered": "Status delivery diperbarui",
  "conversation.created": "Percakapan baru dibuat",
  "conversation.resolved": "Percakapan ditandai selesai",
  "contact.created": "Kontak baru ditambahkan",
  "broadcast.completed": "Broadcast selesai diproses",
};

export const EVENTS = WEBHOOK_EVENTS;
