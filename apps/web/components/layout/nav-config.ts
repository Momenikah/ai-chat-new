import type { MemberRole } from "@aichat/shared";
import {
  LayoutDashboard,
  MessagesSquare,
  Users,
  Send,
  FileText,
  Bot,
  BookOpen,
  FlaskConical,
  Plug,
  UsersRound,
  Filter,
  Settings,
  Building2,
  Zap,
  MousePointerClick,
  KeyRound,
  Webhook,
  Code2,
  Workflow,
  CreditCard,
  Rocket,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Minimum role required to see this item. */
  minRole: MemberRole;
  /** Items not yet implemented. */
  comingSoon?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Utama",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        minRole: "VIEWER",
      },
      {
        label: "Inbox",
        href: "/dashboard/inbox",
        icon: MessagesSquare,
        minRole: "AGENT",
      },
      {
        label: "Kontak CRM",
        href: "/dashboard/contacts",
        icon: Users,
        minRole: "VIEWER",
      },
      {
        label: "Segment",
        href: "/dashboard/segments",
        icon: Filter,
        minRole: "VIEWER",
      },
    ],
  },
  {
    title: "Pertumbuhan",
    items: [
      {
        label: "Broadcast",
        href: "/dashboard/broadcasts",
        icon: Send,
        minRole: "ADMIN",
      },
      {
        label: "Template Pesan",
        href: "/dashboard/templates",
        icon: FileText,
        minRole: "VIEWER",
      },
      {
        label: "Quick Reply",
        href: "/dashboard/quick-replies",
        icon: Zap,
        minRole: "AGENT",
      },
      {
        label: "Interactive Message",
        href: "/dashboard/interactive-messages",
        icon: MousePointerClick,
        minRole: "AGENT",
      },
      {
        label: "AI Chatbot",
        href: "/dashboard/ai-agent",
        icon: Bot,
        minRole: "VIEWER",
      },
      {
        label: "Knowledge Base",
        href: "/dashboard/knowledge",
        icon: BookOpen,
        minRole: "VIEWER",
      },
      {
        label: "AI Playground",
        href: "/dashboard/playground",
        icon: FlaskConical,
        minRole: "AGENT",
      },
    ],
  },
  {
    title: "Developer",
    items: [
      {
        label: "API Keys",
        href: "/dashboard/developer/api-keys",
        icon: KeyRound,
        minRole: "ADMIN",
      },
      {
        label: "Webhooks",
        href: "/dashboard/developer/webhooks",
        icon: Webhook,
        minRole: "ADMIN",
      },
      {
        label: "API Docs",
        href: "/dashboard/developer/api-docs",
        icon: Code2,
        minRole: "VIEWER",
      },
      {
        label: "n8n Integration",
        href: "/dashboard/developer/n8n",
        icon: Workflow,
        minRole: "ADMIN",
      },
    ],
  },
  {
    title: "Workspace",
    items: [
      {
        label: "Channel",
        href: "/dashboard/channels",
        icon: Plug,
        minRole: "VIEWER",
      },
      {
        label: "Tim",
        href: "/dashboard/settings/team",
        icon: UsersRound,
        minRole: "VIEWER",
      },
      {
        label: "Billing",
        href: "/dashboard/billing",
        icon: CreditCard,
        minRole: "VIEWER",
      },
      {
        label: "Pengaturan",
        href: "/dashboard/settings",
        icon: Settings,
        minRole: "ADMIN",
      },
      {
        label: "Setup Wizard",
        href: "/dashboard/onboarding",
        icon: Rocket,
        minRole: "ADMIN",
      },
      {
        label: "Daftar Workspace",
        href: "/dashboard/workspaces",
        icon: Building2,
        minRole: "VIEWER",
      },
    ],
  },
];
