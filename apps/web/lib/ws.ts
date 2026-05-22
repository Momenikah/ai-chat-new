import type { InboxEvent } from "@aichat/shared";

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080/ws";

export interface InboxSocketOptions {
  workspaceId: string;
  token: string;
  onEvent: (event: InboxEvent) => void;
  onStatusChange?: (status: "connecting" | "open" | "closed") => void;
}

export interface InboxSocket {
  /** Send a JSON-encodable frame to the server. */
  send: (frame: unknown) => void;
  /** Close the connection and stop reconnect attempts. */
  close: () => void;
}

/**
 * createInboxSocket opens a WebSocket to the inbox hub and automatically
 * reconnects with bounded exponential backoff. The latest event handler is
 * read each tick so a parent component can change its callback without
 * tearing the socket down.
 */
export function createInboxSocket(opts: InboxSocketOptions): InboxSocket {
  const handlersRef = { current: opts };
  let ws: WebSocket | null = null;
  let closed = false;
  let attempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const url = `${WS_URL}?workspace_id=${encodeURIComponent(
    opts.workspaceId,
  )}&token=${encodeURIComponent(opts.token)}`;

  function connect() {
    if (closed) return;
    handlersRef.current.onStatusChange?.("connecting");
    ws = new WebSocket(url);

    ws.onopen = () => {
      attempt = 0;
      handlersRef.current.onStatusChange?.("open");
    };

    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as InboxEvent;
        handlersRef.current.onEvent(event);
      } catch {
        /* ignore non-JSON frames */
      }
    };

    ws.onclose = () => {
      handlersRef.current.onStatusChange?.("closed");
      if (closed) return;
      const delay = Math.min(15_000, 1000 * Math.pow(2, attempt++));
      reconnectTimer = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      // onclose fires next; treat error as a hint and let close drive reconnect.
      ws?.close();
    };
  }

  connect();

  return {
    send(frame: unknown) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(frame));
      }
    },
    close() {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    },
  };
}
