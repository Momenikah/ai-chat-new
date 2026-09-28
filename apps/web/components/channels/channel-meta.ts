import {
  Instagram,
  MessageCircle,
  MessageSquareMore,
  Send,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ChannelStatus, ChannelType } from "@aichat/shared";

/** Per-channel-type icon + accent colour. */
export const CHANNEL_META: Record<
  ChannelType,
  { icon: LucideIcon; label: string; color: string }
> = {
  whatsapp: { icon: MessageCircle, label: "WhatsApp Business", color: "#25D366" },
  instagram: { icon: Instagram, label: "Instagram DM", color: "#E1306C" },
  messenger: { icon: Send, label: "Facebook Messenger", color: "#0084FF" },
  onesender: { icon: MessageSquareMore, label: "WA OneSender", color: "#128C7E" },
  starsender: { icon: Zap, label: "WA StarSender", color: "#F59E0B" },
};

type BadgeVariant = "success" | "warning" | "secondary" | "destructive";

/** Per-status label + badge variant + dot colour. */
export const STATUS_META: Record<
  ChannelStatus,
  { label: string; variant: BadgeVariant; dot: string }
> = {
  connected: { label: "Terhubung", variant: "success", dot: "bg-emerald-500" },
  pending: { label: "Menunggu", variant: "warning", dot: "bg-amber-500" },
  disconnected: {
    label: "Terputus",
    variant: "secondary",
    dot: "bg-zinc-400",
  },
  error: { label: "Error", variant: "destructive", dot: "bg-red-500" },
};
