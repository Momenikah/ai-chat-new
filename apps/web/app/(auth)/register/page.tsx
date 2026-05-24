"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Building2,
  Check,
  Eye,
  EyeOff,
  Instagram,
  Loader2,
  Mail,
  MessageCircle,
  MessagesSquare,
  Phone,
  Rocket,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { ChannelType } from "@aichat/shared";
import { api, ApiException } from "@/lib/api";
import { storeTokens } from "@/lib/auth";
import {
  parseEmailList,
  saveOnboardingIntent,
  type OnboardingIntent,
} from "@/lib/onboarding-intent";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type StepKey = "workspace" | "account" | "launch";
type RegisterUpdate = (
  key: keyof RegisterForm,
) => (
  e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
) => void;

const STEPS: { key: StepKey; label: string; icon: LucideIcon }[] = [
  { key: "workspace", label: "Workspace", icon: Building2 },
  { key: "account", label: "Owner", icon: UserRound },
  { key: "launch", label: "Mulai", icon: Rocket },
];

const BRAND_COLORS = [
  "#18181b",
  "#0f766e",
  "#2563eb",
  "#7c3aed",
  "#dc2626",
  "#f59e0b",
];

const CHANNELS: {
  type: ChannelType;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  {
    type: "whatsapp",
    label: "WhatsApp",
    hint: "Paling cepat untuk CS dan broadcast.",
    icon: Phone,
  },
  {
    type: "instagram",
    label: "Instagram",
    hint: "Untuk prospek dari DM akun bisnis.",
    icon: Instagram,
  },
  {
    type: "messenger",
    label: "Messenger",
    hint: "Untuk pesan dari Facebook Page.",
    icon: MessageCircle,
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  const [stepIdx, setStepIdx] = useState(0);
  const [attempted, setAttempted] = useState<Record<StepKey, boolean>>({
    workspace: false,
    account: false,
    launch: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState<RegisterForm>(() => ({
    workspaceName: "",
    brandColor: BRAND_COLORS[0],
    timezone: getLocalTimezone(),
    channel: "whatsapp",
    name: "",
    email: "",
    password: "",
    aiEnabled: true,
    inviteEmails: "",
  }));

  const step = STEPS[stepIdx];
  const progress = Math.round(((stepIdx + 1) / STEPS.length) * 100);
  const emails = useMemo(() => parseEmailList(form.inviteEmails), [
    form.inviteEmails,
  ]);
  const workspaceValid = form.workspaceName.trim().length >= 2;
  const accountValid =
    form.name.trim().length >= 2 &&
    isValidEmail(form.email) &&
    form.password.length >= 8;

  const mutation = useMutation({
    mutationFn: async () => {
      const intent = buildIntent(form, emails);
      const auth = await api.auth.register({
        workspace_name: intent.workspaceName,
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });

      storeTokens(auth.access_token, auth.refresh_token);
      saveOnboardingIntent(intent);

      try {
        const { workspaces } = await api.workspaces.list();
        const workspace = workspaces[0];
        if (workspace) {
          await api.workspaces.update(workspace.id, {
            name: intent.workspaceName,
            brand_color: intent.brandColor,
            timezone: intent.timezone,
          });

          for (const email of intent.inviteEmails) {
            await api.members.invite(workspace.id, {
              email,
              role: "AGENT",
            });
          }
        }
      } catch {
        // The dashboard wizard reads the saved intent and lets the user finish
        // setup if a secondary onboarding request fails.
      }

      return auth;
    },
    onError: (err) => {
      if (!(err instanceof ApiException) || !err.details) return;
      if (err.details.workspace_name) {
        setStepIdx(0);
        return;
      }
      if (err.details.name || err.details.email || err.details.password) {
        setStepIdx(1);
      }
    },
    onSuccess: (data) => {
      setUser(data.user);
      router.replace("/dashboard/onboarding");
      router.refresh();
    },
  });

  const update: RegisterUpdate =
    (key) =>
    (e) => {
      if (mutation.isError) mutation.reset();
      setForm((f) => ({ ...f, [key]: e.target.value }));
    };

  const fieldError = (field: string) =>
    mutation.error instanceof ApiException
      ? mutation.error.details?.[field]
      : undefined;

  const generalError =
    mutation.error instanceof ApiException && !mutation.error.details
      ? mutation.error.message
      : mutation.error && !(mutation.error instanceof ApiException)
        ? "Tidak dapat terhubung ke server"
        : null;

  const workspaceError =
    fieldError("workspace_name") ||
    (attempted.workspace && !workspaceValid
      ? "Nama workspace minimal 2 karakter"
      : undefined);
  const accountErrors = {
    name:
      fieldError("name") ||
      (attempted.account && form.name.trim().length < 2
        ? "Nama lengkap minimal 2 karakter"
        : undefined),
    email:
      fieldError("email") ||
      (attempted.account && !isValidEmail(form.email)
        ? "Masukkan email yang valid"
        : undefined),
    password:
      fieldError("password") ||
      (attempted.account && form.password.length < 8
        ? "Password minimal 8 karakter"
        : undefined),
  };

  function goNext() {
    setAttempted((state) => ({ ...state, [step.key]: true }));
    if (step.key === "workspace" && !workspaceValid) return;
    if (step.key === "account" && !accountValid) return;
    setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  }

  function goPrev() {
    setStepIdx((i) => Math.max(i - 1, 0));
  }

  function submit() {
    setAttempted({ workspace: true, account: true, launch: true });
    if (!workspaceValid) {
      setStepIdx(0);
      return;
    }
    if (!accountValid) {
      setStepIdx(1);
      return;
    }
    mutation.mutate();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="mx-auto w-full max-w-xl space-y-5"
    >
      <div className="space-y-2 lg:hidden">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-950">
          <MessagesSquare className="h-5 w-5 text-white" />
        </div>
      </div>

      <div className="space-y-2">
        <Badge variant="secondary" className="w-fit">
          Setup 2 menit
        </Badge>
        <div className="space-y-1.5">
          <h2 className="text-2xl font-semibold tracking-tight">
            Buat workspace baru
          </h2>
          <p className="max-w-lg text-sm text-muted-foreground">
            Cukup buat workspace dan akun owner. Detail teknisnya dilanjutkan
            otomatis di dashboard.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
          <motion.div
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
            className="h-full rounded-full bg-zinc-950"
          />
        </div>
        <Stepper currentIdx={stepIdx} onJump={setStepIdx} />
      </div>

      <div className="rounded-lg border border-border bg-white p-4 shadow-sm sm:p-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={step.key}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18 }}
          >
            {step.key === "workspace" && (
              <WorkspaceStep
                form={form}
                error={workspaceError}
                onUpdate={update}
                onPatch={(patch) => setForm((f) => ({ ...f, ...patch }))}
              />
            )}
            {step.key === "account" && (
              <AccountStep
                form={form}
                errors={accountErrors}
                showPassword={showPassword}
                onTogglePassword={() => setShowPassword((v) => !v)}
                onUpdate={update}
              />
            )}
            {step.key === "launch" && (
              <LaunchStep
                form={form}
                emails={emails}
                error={generalError}
                onUpdate={update}
                onPatch={(patch) => setForm((f) => ({ ...f, ...patch }))}
              />
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={goPrev}
            disabled={stepIdx === 0 || mutation.isPending}
          >
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Button>

          {step.key === "launch" ? (
            <Button type="button" onClick={submit} disabled={mutation.isPending}>
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4" />
              )}
              Buat workspace
            </Button>
          ) : (
            <Button type="button" onClick={goNext} disabled={mutation.isPending}>
              Lanjut <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Sudah punya akun?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Masuk
        </Link>
      </p>
    </motion.div>
  );
}

function Stepper({
  currentIdx,
  onJump,
}: {
  currentIdx: number;
  onJump: (i: number) => void;
}) {
  return (
    <ol className="grid grid-cols-3 gap-2">
      {STEPS.map((s, i) => {
        const active = i === currentIdx;
        const done = i < currentIdx;
        const Icon = s.icon;
        return (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => onJump(i)}
              className={cn(
                "flex h-10 w-full items-center gap-2 rounded-lg border px-3 text-left text-xs font-medium transition-colors",
                active && "border-zinc-950 bg-zinc-950 text-white",
                done &&
                  !active &&
                  "border-emerald-200 bg-emerald-50 text-emerald-700",
                !active &&
                  !done &&
                  "border-border bg-white text-muted-foreground hover:bg-zinc-50",
              )}
            >
              {done ? (
                <Check className="h-4 w-4 shrink-0" />
              ) : (
                <Icon className="h-4 w-4 shrink-0" />
              )}
              <span className="truncate">{s.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function WorkspaceStep({
  form,
  error,
  onUpdate,
  onPatch,
}: {
  form: RegisterForm;
  error?: string;
  onUpdate: RegisterUpdate;
  onPatch: (patch: Partial<RegisterForm>) => void;
}) {
  return (
    <div className="space-y-5">
      <StepHeader
        icon={Building2}
        title="Workspace"
        desc="Nama bisnis, warna brand, dan channel utama."
      />

      <Field
        id="workspaceName"
        label="Nama perusahaan / workspace"
        placeholder="PT Maju Jaya"
        value={form.workspaceName}
        onChange={onUpdate("workspaceName")}
        error={error}
        autoComplete="organization"
      />

      <div className="space-y-2">
        <Label>Warna brand</Label>
        <div className="flex flex-wrap gap-2">
          {BRAND_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onPatch({ brandColor: color })}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg border shadow-sm transition-transform active:scale-95",
                form.brandColor === color
                  ? "border-zinc-950 ring-2 ring-zinc-950 ring-offset-2"
                  : "border-border",
              )}
              style={{ backgroundColor: color }}
              aria-label={`Pilih warna ${color}`}
            >
              {form.brandColor === color && (
                <Check className="h-4 w-4 text-white drop-shadow" />
              )}
            </button>
          ))}
          <input
            type="color"
            value={form.brandColor}
            onChange={(e) => onPatch({ brandColor: e.target.value })}
            className="h-9 w-12 cursor-pointer rounded-lg border border-input bg-white p-1"
            aria-label="Pilih warna custom"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Channel utama</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {CHANNELS.map((channel) => {
            const selected = form.channel === channel.type;
            const Icon = channel.icon;
            return (
              <button
                key={channel.type}
                type="button"
                onClick={() => onPatch({ channel: channel.type })}
                className={cn(
                  "min-h-[102px] rounded-lg border p-3 text-left transition-colors",
                  selected
                    ? "border-zinc-950 bg-zinc-950 text-white"
                    : "border-border bg-white hover:bg-zinc-50",
                )}
              >
                <span
                  className={cn(
                    "mb-3 flex h-8 w-8 items-center justify-center rounded-lg",
                    selected
                      ? "bg-white text-zinc-950"
                      : "bg-zinc-100 text-zinc-950",
                  )}
                >
                  {selected ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </span>
                <span className="block text-sm font-medium">
                  {channel.label}
                </span>
                <span
                  className={cn(
                    "mt-1 block text-xs",
                    selected ? "text-zinc-300" : "text-muted-foreground",
                  )}
                >
                  {channel.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AccountStep({
  form,
  errors,
  showPassword,
  onTogglePassword,
  onUpdate,
}: {
  form: RegisterForm;
  errors: { name?: string; email?: string; password?: string };
  showPassword: boolean;
  onTogglePassword: () => void;
  onUpdate: RegisterUpdate;
}) {
  return (
    <div className="space-y-5">
      <StepHeader
        icon={ShieldCheck}
        title="Akun owner"
        desc="Akun ini punya akses penuh ke workspace."
      />

      <Field
        id="name"
        label="Nama lengkap"
        placeholder="Budi Santoso"
        value={form.name}
        onChange={onUpdate("name")}
        error={errors.name}
        autoComplete="name"
        icon={UserRound}
      />

      <Field
        id="email"
        label="Email"
        type="email"
        placeholder="budi@perusahaan.com"
        value={form.email}
        onChange={onUpdate("email")}
        error={errors.email}
        autoComplete="email"
        icon={Mail}
      />

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            placeholder="Minimal 8 karakter"
            value={form.password}
            onChange={onUpdate("password")}
            autoComplete="new-password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={onTogglePassword}
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-zinc-100 hover:text-foreground"
            aria-label={
              showPassword ? "Sembunyikan password" : "Tampilkan password"
            }
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-red-600">{errors.password}</p>
        )}
      </div>
    </div>
  );
}

function LaunchStep({
  form,
  emails,
  error,
  onUpdate,
  onPatch,
}: {
  form: RegisterForm;
  emails: string[];
  error: string | null;
  onUpdate: RegisterUpdate;
  onPatch: (patch: Partial<RegisterForm>) => void;
}) {
  const channel = CHANNELS.find((item) => item.type === form.channel);

  return (
    <div className="space-y-5">
      <StepHeader
        icon={Sparkles}
        title="Siap mulai"
        desc="Pilihan ini langsung dibawa ke wizard dashboard."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <SummaryItem
          icon={Building2}
          label="Workspace"
          value={form.workspaceName || "Belum diisi"}
        />
        <SummaryItem
          icon={Phone}
          label="Channel utama"
          value={channel?.label ?? "WhatsApp"}
        />
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-border bg-zinc-50/70 p-3">
        <input
          type="checkbox"
          checked={form.aiEnabled}
          onChange={(e) => onPatch({ aiEnabled: e.target.checked })}
          className="mt-1 h-4 w-4 rounded border-zinc-300 text-zinc-950"
        />
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Bot className="h-4 w-4" /> Lanjutkan setup AI chatbot
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Bisa dimatikan sekarang dan diaktifkan nanti dari dashboard.
          </span>
        </span>
      </label>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="inviteEmails">Undang agent awal</Label>
          {emails.length > 0 && (
            <Badge variant="secondary">{emails.length} email valid</Badge>
          )}
        </div>
        <textarea
          id="inviteEmails"
          rows={3}
          value={form.inviteEmails}
          onChange={onUpdate("inviteEmails")}
          placeholder="agent@perusahaan.com, support@perusahaan.com"
          className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function StepHeader({
  icon: Icon,
  title,
  desc,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-white">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  error,
  type = "text",
  icon: Icon,
  ...props
}: {
  id: string;
  label: string;
  error?: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autoComplete?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          id={id}
          type={type}
          required
          className={cn(Icon && "pl-9")}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function SummaryItem({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-white p-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-950">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

type RegisterForm = {
  workspaceName: string;
  brandColor: string;
  timezone: string;
  channel: ChannelType;
  name: string;
  email: string;
  password: string;
  aiEnabled: boolean;
  inviteEmails: string;
};

function buildIntent(
  form: RegisterForm,
  inviteEmails: string[],
): OnboardingIntent {
  return {
    workspaceName: form.workspaceName.trim(),
    brandColor: form.brandColor,
    timezone: form.timezone,
    selectedChannels: [form.channel],
    aiEnabled: form.aiEnabled,
    inviteEmails,
    createdAt: Date.now(),
  };
}

function getLocalTimezone() {
  if (typeof Intl === "undefined") return "Asia/Jakarta";
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
