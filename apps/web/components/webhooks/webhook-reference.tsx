"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BookOpen, ChevronDown, Code2, Radio } from "lucide-react";
import { WEBHOOK_EVENTS } from "@aichat/shared";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const EVENT_DESCRIPTIONS: Record<string, string> = {
  "message.received": "Pesan masuk baru dari pelanggan di channel manapun.",
  "message.sent": "Pesan keluar berhasil dikirim oleh agent atau bot.",
  "message.delivered": "Status delivery pesan diperbarui (delivered/read).",
  "conversation.created": "Percakapan baru dibuat (kontak pertama kali chat).",
  "conversation.resolved": "Percakapan ditandai selesai (resolved).",
  "contact.created": "Kontak baru ditambahkan ke CRM.",
  "broadcast.completed": "Campaign broadcast selesai diproses worker.",
};

const SAMPLE_PAYLOAD = `{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "event": "message.received",
  "workspace_id": "9b2...c1",
  "occurred_at": "2026-05-21T08:30:00Z",
  "data": {
    "id": "msg_123",
    "conversation_id": "conv_456",
    "direction": "inbound",
    "body": "Halo, masih buka?"
  }
}`;

const VERIFY_SNIPPET = `// Node.js — verifikasi X-AIChat-Signature
import crypto from "node:crypto";

function verify(rawBody, signatureHeader, secret) {
  // header: "sha256=<hex>"
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  // timing-safe compare
  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader),
    Buffer.from(expected),
  );
}

// Express handler (pakai raw body, bukan parsed JSON)
app.post("/webhook", express.raw({ type: "*/*" }), (req, res) => {
  const sig = req.header("X-AIChat-Signature");
  if (!verify(req.body, sig, process.env.AICHAT_SECRET)) {
    return res.status(401).send("invalid signature");
  }
  const event = JSON.parse(req.body.toString());
  // ... proses event
  res.sendStatus(200);
});`;

export function WebhookReference() {
  const [open, setOpen] = useState(false);

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-zinc-50"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white">
          <BookOpen className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Referensi event & verifikasi</p>
          <p className="text-xs text-muted-foreground">
            Daftar event, contoh payload, dan cara verifikasi signature HMAC.
          </p>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="space-y-5 p-4">
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  <Radio className="h-3.5 w-3.5" /> Katalog event
                </h3>
                <ul className="space-y-1.5">
                  {WEBHOOK_EVENTS.map((e) => (
                    <li
                      key={e}
                      className="flex items-start gap-2 rounded-lg bg-zinc-50 px-3 py-2"
                    >
                      <code className="shrink-0 font-mono text-[11px] text-zinc-900">
                        {e}
                      </code>
                      <span className="text-xs text-muted-foreground">
                        {EVENT_DESCRIPTIONS[e] ?? ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  <Code2 className="h-3.5 w-3.5" /> Contoh payload
                </h3>
                <pre className="overflow-x-auto rounded-lg border border-input bg-zinc-950 px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-100">
                  {SAMPLE_PAYLOAD}
                </pre>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Header tiap delivery: <code>X-AIChat-Event</code>,{" "}
                  <code>X-AIChat-Delivery</code> (id unik, sama lintas retry),
                  dan <code>X-AIChat-Signature</code>.
                </p>
              </section>

              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  <Code2 className="h-3.5 w-3.5" /> Verifikasi signature
                </h3>
                <pre className="overflow-x-auto rounded-lg border border-input bg-zinc-950 px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-100">
                  {VERIFY_SNIPPET}
                </pre>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Selalu hitung HMAC atas <strong>raw body</strong> (sebelum
                  parsing JSON) memakai secret endpoint, lalu bandingkan secara
                  timing-safe.
                </p>
              </section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
