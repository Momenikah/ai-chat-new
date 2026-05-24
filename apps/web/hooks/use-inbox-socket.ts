import { useEffect, useRef, useState } from "react";
import type { InboxEvent } from "@aichat/shared";
import { createInboxSocket, type InboxSocket } from "@/lib/ws";
import { getAccessToken } from "@/lib/auth";

export type SocketStatus = "connecting" | "open" | "closed";

/**
 * useInboxSocket opens an authenticated WebSocket to the inbox hub for the
 * given workspace. The latest onEvent callback is read each tick via a ref,
 * so consumers can update their handler without tearing the connection down.
 */
export function useInboxSocket(
  workspaceId: string | null,
  onEvent: (event: InboxEvent) => void,
) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  const socketRef = useRef<InboxSocket | null>(null);
  const [status, setStatus] = useState<SocketStatus>("closed");

  useEffect(() => {
    if (!workspaceId) return;
    const token = getAccessToken();
    if (!token) return;

    const sock = createInboxSocket({
      workspaceId,
      token,
      onEvent: (event) => handlerRef.current(event),
      onStatusChange: setStatus,
    });
    socketRef.current = sock;

    return () => {
      sock.close();
      socketRef.current = null;
    };
  }, [workspaceId]);

  return {
    status,
    sendTyping: (conversationId: string) => {
      socketRef.current?.send({
        type: "typing",
        conversation_id: conversationId,
      });
    },
  };
}
