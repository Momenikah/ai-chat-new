"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CreditCard,
  Plug,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";

const LINKS: {
  href: string;
  icon: LucideIcon;
  title: string;
  desc: string;
}[] = [
  {
    href: "/dashboard/settings/team",
    icon: UsersRound,
    title: "Tim",
    desc: "Anggota & undangan",
  },
  {
    href: "/dashboard/channels",
    icon: Plug,
    title: "Channel",
    desc: "WhatsApp / IG / Messenger",
  },
  {
    href: "/dashboard/billing",
    icon: CreditCard,
    title: "Billing",
    desc: "Paket & invoice",
  },
  {
    href: "/dashboard/workspaces",
    icon: Building2,
    title: "Daftar Workspace",
    desc: "Pindah / buat workspace",
  },
];

export function SettingsQuickLinks() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {LINKS.map((l) => {
        const Icon = l.icon;
        return (
          <Link key={l.href} href={l.href}>
            <Card className="group flex items-center gap-3 p-4 transition-shadow hover:shadow-sm">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{l.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {l.desc}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-zinc-400 transition-transform group-hover:translate-x-0.5" />
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
