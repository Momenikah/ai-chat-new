"use client";

import { useState } from "react";
import type { WebhookEvent } from "@aichat/shared";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { CodeBlock } from "@/components/n8n/code-block";
import {
  EVENT_LABELS,
  EVENT_PAYLOADS,
  EVENTS,
} from "@/components/n8n/event-payloads";

export function PayloadExplorer() {
  const [event, setEvent] = useState<WebhookEvent>("message.received");

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Contoh payload per event</h2>
          <p className="text-sm text-muted-foreground">
            {EVENT_LABELS[event]}. Header <code>X-AIChat-Event</code> &{" "}
            <code>X-AIChat-Signature</code> juga dikirim.
          </p>
        </div>
        <Select
          value={event}
          onChange={(e) => setEvent(e.target.value as WebhookEvent)}
          className="h-9 w-52 text-sm"
        >
          {EVENTS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </Select>
      </div>
      <CodeBlock code={EVENT_PAYLOADS[event]} />
    </Card>
  );
}
