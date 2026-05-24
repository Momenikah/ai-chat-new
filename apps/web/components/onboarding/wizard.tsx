"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  Instagram,
  Loader2,
  MessageCircle,
  Palette,
  Phone,
  Plus,
  Rocket,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import type { ChannelType, MemberRole } from "@aichat/shared";
import { CHANNEL_LABELS, INVITABLE_ROLES } from "@aichat/shared";
import { api, ApiException } from "@/lib/api";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  BrandingPreview,
  ColorPresets,
} from "@/components/settings/branding-preview";
import { PROMPT_PRESETS } from "@/components/ai-agent/prompt-presets";
import {
  clearOnboardingIntent,
  readOnboardingIntent,
  type OnboardingIntent,
} from "@/lib/onboarding-intent";

const STORAGE_PREFIX = "aichat_onboarding_done_";

const AI_VARS = ["name", "brand", "phone", "company"];
const AI_PROMPT_LIMIT = 4000;

const TIMEZONES = [
  "Asia/Jakarta",
  "Asia/Makassar",
  "Asia/Jayapura",
  "Asia/Singapore",
  "UTC",
];

const TONES = [
  "profesional dan ramah",
  "santai dan akrab",
  "formal dan singkat",
  "antusias dan persuasif",
];

const LANGUAGES = [
  { value: "id", label: "Bahasa Indonesia" },
  { value: "en", label: "English" },
];

const CHANNEL_META: {
  type: ChannelType;
  icon: typeof Phone;
  href: string;
  blurb: string;
}[] = [
  {
    type: "whatsapp",
    icon: Phone,
    href: "/dashboard/channels/new",
    blurb: "Hubungkan nomor WhatsApp Business via Meta Cloud API.",
  },
  {
    type: "instagram",
    icon: Instagram,
    href: "/dashboard/channels/instagram",
    blurb: "Balas DM Instagram bisnis langsung dari inbox.",
  },
  {
    type: "messenger",
    icon: MessageCircle,
    href: "/dashboard/channels/messenger",
    blurb: "Tangani pesan Facebook Page dengan rute & assignment.",
  },
];

interface InviteDraft {
  email: string;
  role: MemberRole;
}

type StepKey = "welcome" | "branding" | "channels" | "team" | "ai" | "done";

const STEPS: { key: StepKey; label: string; icon: typeof Rocket }[] = [
  { key: "welcome", label: "Mulai", icon: Rocket },
  { key: "branding", label: "Branding", icon: Palette },
  { key: "channels", label: "Channel", icon: Phone },
  { key: "team", label: "Tim", icon: UsersRound },
  { key: "ai", label: "AI Chatbot", icon: Bot },
  { key: "done", label: "Selesai", icon: CheckCircle2 },
];

function resolveSetupTasks(intent: OnboardingIntent | null): StepKey[] {
  if (!intent) return ["branding", "channels", "team", "ai"];

  const tasks: StepKey[] = ["branding"];
  if (intent.selectedChannels.length > 0) tasks.push("channels");
  if (intent.inviteEmails.length > 0) tasks.push("team");
  if (intent.aiEnabled) tasks.push("ai");
  return tasks;
}

/** Per-step completion derived from real workspace data. */
export type Completion = Record<StepKey, boolean>;

function useSetupCompletion(workspaceId: string | null): {
  completion: Completion;
  ready: boolean;
} {
  const enabled = Boolean(workspaceId);
  const workspaceQ = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => api.workspaces.get(workspaceId as string),
    enabled,
  });
  const channelsQ = useQuery({
    queryKey: ["channels", workspaceId],
    queryFn: () => api.channels.list(workspaceId as string),
    enabled,
  });
  const membersQ = useQuery({
    queryKey: ["members", workspaceId],
    queryFn: () => api.members.list(workspaceId as string),
    enabled,
  });
  const aiQ = useQuery({
    queryKey: ["ai-agent", workspaceId],
    queryFn: () => api.aiAgent.get(workspaceId as string),
    enabled,
  });

  const ws = workspaceQ.data?.workspace;
  const branding = Boolean(
    ws && ws.name && ws.brand_color && ws.brand_color !== "#000000",
  );
  const channels = (channelsQ.data?.channels ?? []).length > 0;
  const team = (membersQ.data?.members ?? []).length > 1;
  const ai = Boolean(aiQ.data?.enabled && aiQ.data?.prompt_approved);

  return {
    completion: {
      welcome: true,
      branding,
      channels,
      team,
      ai,
      done: branding && channels && team && ai,
    },
    ready:
      workspaceQ.isSuccess &&
      channelsQ.isSuccess &&
      membersQ.isSuccess &&
      aiQ.isSuccess,
  };
}

export function OnboardingWizard() {
  const router = useRouter();
  const workspaceId = useWorkspaceStore((s) => s.currentId);
  const can = useWorkspaceStore((s) => s.can);
  const current = useWorkspaceStore((s) =>
    s.workspaces.find((w) => w.id === s.currentId),
  );
  const isAdmin = can("ADMIN");

  const [intent] = useState<OnboardingIntent | null>(() =>
    readOnboardingIntent(),
  );
  const [stepIdx, setStepIdx] = useState(0);

  const { completion, ready } = useSetupCompletion(workspaceId);
  const setupTasks = useMemo(() => resolveSetupTasks(intent), [intent]);
  const visibleSteps = useMemo(
    () =>
      STEPS.filter(
        (s) =>
          s.key === "welcome" || s.key === "done" || setupTasks.includes(s.key),
      ),
    [setupTasks],
  );
  const step = visibleSteps[stepIdx] ?? visibleSteps[0];

  useEffect(() => {
    setStepIdx((i) => Math.min(i, visibleSteps.length - 1));
  }, [visibleSteps.length]);

  // Resume: jump to the first incomplete step once data is ready (once only).
  const resumedRef = useState(() => ({ done: false }))[0];
  useEffect(() => {
    if (!ready || resumedRef.done) return;
    resumedRef.done = true;
    const firstIncomplete = setupTasks.find((k) => !completion[k]);
    const target = firstIncomplete ?? "done";
    const idx = visibleSteps.findIndex((s) => s.key === target);
    if (idx > 0) setStepIdx(idx);
  }, [ready, completion, resumedRef, setupTasks, visibleSteps]);

  const completedCount = setupTasks.filter((k) => completion[k]).length;
  const percent = Math.round((completedCount / setupTasks.length) * 100);

  const goNext = () =>
    setStepIdx((i) => Math.min(i + 1, visibleSteps.length - 1));
  const goPrev = () => setStepIdx((i) => Math.max(i - 1, 0));
  const goTo = (key: StepKey) => {
    const i = visibleSteps.findIndex((s) => s.key === key);
    if (i >= 0) setStepIdx(i);
  };

  // Mark as completed when user reaches the done step.
  useEffect(() => {
    if (step.key === "done" && workspaceId && typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_PREFIX + workspaceId, "1");
      clearOnboardingIntent();
    }
  }, [step.key, workspaceId]);

  if (!workspaceId || !current) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[420px] rounded-2xl" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Akses terbatas</CardTitle>
            <CardDescription>
              Hanya ADMIN atau OWNER yang dapat menjalankan wizard pengaturan
              workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4" /> Kembali ke dashboard
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Wizard pengaturan workspace
        </h1>
        <p className="text-sm text-muted-foreground">
          Langkah berikut disesuaikan untuk menyiapkan{" "}
          <span className="font-medium text-foreground">{current.name}</span>{" "}
          agar siap menerima pesan pertama.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
            <motion.div
              animate={{ width: `${percent}%` }}
              transition={{ duration: 0.4 }}
              className="h-full rounded-full bg-emerald-500"
            />
          </div>
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            {completedCount}/{setupTasks.length} selesai
          </span>
        </div>
      </div>

      <Stepper
        steps={visibleSteps}
        currentIdx={stepIdx}
        completion={completion}
        setupTasks={setupTasks}
        onJump={(i) => setStepIdx(i)}
      />

      <Card className="overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={step.key}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
            className="p-6"
          >
            {step.key === "welcome" && (
              <WelcomeStep
                workspaceName={current.name}
                intent={intent}
                completion={completion}
                setupTasks={setupTasks}
                percent={percent}
                onNext={goNext}
              />
            )}
            {step.key === "branding" && (
              <BrandingStep
                workspaceId={workspaceId}
                intent={intent}
                onPrev={goPrev}
                onNext={goNext}
              />
            )}
            {step.key === "channels" && (
              <ChannelsStep
                workspaceId={workspaceId}
                selectedChannels={intent?.selectedChannels ?? []}
                onPrev={goPrev}
                onNext={goNext}
              />
            )}
            {step.key === "team" && (
              <TeamStep
                workspaceId={workspaceId}
                initialEmails={intent?.inviteEmails ?? []}
                onPrev={goPrev}
                onNext={goNext}
              />
            )}
            {step.key === "ai" && (
              <AIStep
                workspaceId={workspaceId}
                preferred={intent?.aiEnabled !== false}
                onPrev={goPrev}
                onNext={goNext}
              />
            )}
            {step.key === "done" && (
              <DoneStep
                completion={completion}
                setupTasks={setupTasks}
                percent={percent}
                onGoStep={(k) => goTo(k)}
                onRestart={() => goTo("welcome")}
                onFinish={() => router.push("/dashboard")}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </Card>
    </div>
  );
}

/* ----------------------------- Stepper UI ------------------------------ */

function Stepper({
  steps,
  currentIdx,
  completion,
  setupTasks,
  onJump,
}: {
  steps: typeof STEPS;
  currentIdx: number;
  completion: Completion;
  setupTasks: StepKey[];
  onJump: (i: number) => void;
}) {
  return (
    <ol className="flex items-center gap-2 overflow-x-auto pb-1">
      {steps.map((s, i) => {
        const active = i === currentIdx;
        // A step shows a checkmark when its real-data requirement is met
        // (welcome/done excluded — they aren't data tasks themselves).
        const required = setupTasks.includes(s.key);
        const completed =
          s.key !== "welcome" &&
          s.key !== "done" &&
          (completion[s.key] || !required);
        const Icon = s.icon;
        return (
          <li key={s.key} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onJump(i)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                active &&
                  "border-zinc-900 bg-zinc-900 text-white shadow-sm",
                completed &&
                  !active &&
                  "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                !active &&
                  !completed &&
                  "border-border bg-white text-muted-foreground hover:bg-zinc-50",
              )}
            >
              {completed ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
              <span>{s.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <span
                className={cn(
                  "h-px w-4 shrink-0",
                  completed ? "bg-emerald-300" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* --------------------------- Step: Welcome ----------------------------- */

function WelcomeStep({
  workspaceName,
  intent,
  completion,
  setupTasks,
  percent,
  onNext,
}: {
  workspaceName: string;
  intent: OnboardingIntent | null;
  completion: Completion;
  setupTasks: StepKey[];
  percent: number;
  onNext: () => void;
}) {
  const allDone = percent === 100;
  const required = (key: StepKey) => setupTasks.includes(key);
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Selamat datang di {workspaceName}
          </h2>
          <p className="text-sm text-muted-foreground">
            {allDone
              ? "Semua langkah sudah selesai. Anda bisa meninjau ulang kapan saja."
              : intent
                ? "Wizard ini mengikuti pilihan saat daftar, jadi hanya langkah penting yang dihitung."
                : "Yuk siapkan workspace dalam beberapa menit. Setiap langkah opsional dan bisa diselesaikan nanti."}
          </p>
        </div>
      </div>

      {intent && (
        <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-zinc-50/70 p-3">
          {intent.selectedChannels.map((type) => (
            <Badge key={type} variant="secondary">
              {CHANNEL_LABELS[type]}
            </Badge>
          ))}
          {intent.inviteEmails.length > 0 && (
            <Badge variant="secondary">
              {intent.inviteEmails.length} undangan tim
            </Badge>
          )}
          {intent.aiEnabled ? (
            <Badge variant="secondary">AI chatbot</Badge>
          ) : (
            <Badge variant="warning">AI nanti</Badge>
          )}
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        <ChecklistRow
          icon={Palette}
          title="Branding"
          desc="Nama, warna, timezone, dan logo bisnis Anda."
          done={completion.branding}
        />
        <ChecklistRow
          icon={Phone}
          title="Channel"
          desc={
            required("channels")
              ? "Hubungkan channel utama pilihan Anda."
              : "Channel bisa dihubungkan setelah dashboard siap."
          }
          done={completion.channels}
        />
        <ChecklistRow
          icon={UsersRound}
          title="Tim"
          desc={
            required("team")
              ? "Kirim undangan agent yang sudah disiapkan."
              : "Undang admin, agent, dan viewer nanti."
          }
          done={completion.team}
        />
        <ChecklistRow
          icon={Bot}
          title="AI Chatbot"
          desc={
            required("ai")
              ? "Atur kepribadian dan system prompt agen AI."
              : "AI chatbot bisa diaktifkan nanti."
          }
          done={completion.ai}
        />
      </ul>

      <div className="flex justify-end">
        <Button onClick={onNext}>
          {allDone ? "Tinjau ulang" : "Mulai"}{" "}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ChecklistRow({
  icon: Icon,
  title,
  desc,
  done,
}: {
  icon: typeof Rocket;
  title: string;
  desc: string;
  done?: boolean;
}) {
  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3",
        done ? "border-emerald-200 bg-emerald-50/40" : "border-border bg-zinc-50/60",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg shadow-sm",
          done ? "bg-emerald-500 text-white" : "bg-white text-zinc-900",
        )}
      >
        {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium">{title}</p>
          {done && <Badge variant="success">selesai</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </li>
  );
}

/* -------------------------- Step: Branding ----------------------------- */

function BrandingStep({
  workspaceId,
  intent,
  onPrev,
  onNext,
}: {
  workspaceId: string;
  intent: OnboardingIntent | null;
  onPrev: () => void;
  onNext: () => void;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => api.workspaces.get(workspaceId),
  });

  const [form, setForm] = useState({
    name: "",
    brand_color: "#18181b",
    timezone: "Asia/Jakarta",
    logo_url: "",
  });

  useEffect(() => {
    if (data?.workspace) {
      setForm({
        name: intent?.workspaceName || data.workspace.name,
        brand_color: intent?.brandColor || data.workspace.brand_color,
        timezone: intent?.timezone || data.workspace.timezone,
        logo_url: data.workspace.logo_url ?? "",
      });
    }
  }, [data, intent]);

  const mutation = useMutation({
    mutationFn: () =>
      api.workspaces.update(workspaceId, {
        name: form.name,
        brand_color: form.brand_color,
        timezone: form.timezone,
        logo_url: form.logo_url.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      onNext();
    },
  });

  const error =
    mutation.error instanceof ApiException ? mutation.error.message : null;

  if (isLoading) return <Skeleton className="h-72 rounded-xl" />;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="space-y-5"
    >
      <StepHeader
        icon={Palette}
        title="Branding bisnis"
        desc="Identitas yang muncul di dashboard, undangan, dan komunikasi keluar."
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_240px]">
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="ob-name">Nama bisnis</Label>
            <Input
              id="ob-name"
              required
              minLength={2}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ob-color">Warna brand</Label>
            <div className="flex items-center gap-3">
              <input
                id="ob-color"
                type="color"
                value={form.brand_color}
                onChange={(e) =>
                  setForm({ ...form, brand_color: e.target.value })
                }
                className="h-9 w-14 cursor-pointer rounded-lg border border-input"
              />
              <span className="text-sm text-muted-foreground">
                {form.brand_color}
              </span>
            </div>
            <ColorPresets
              value={form.brand_color}
              onPick={(hex) => setForm({ ...form, brand_color: hex })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ob-tz">Timezone</Label>
            <Select
              id="ob-tz"
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ob-logo">URL logo (opsional)</Label>
            <Input
              id="ob-logo"
              placeholder="https://…/logo.png"
              value={form.logo_url}
              onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
            />
          </div>
        </div>

        <BrandingPreview
          name={form.name}
          logoUrl={form.logo_url}
          brandColor={form.brand_color}
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <StepFooter
        onPrev={onPrev}
        onSkip={onNext}
        submitLabel="Simpan & lanjut"
        submitting={mutation.isPending}
      />
    </form>
  );
}

/* --------------------------- Step: Channels ---------------------------- */

function ChannelsStep({
  workspaceId,
  selectedChannels,
  onPrev,
  onNext,
}: {
  workspaceId: string;
  selectedChannels: ChannelType[];
  onPrev: () => void;
  onNext: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["channels", workspaceId],
    queryFn: () => api.channels.list(workspaceId),
  });

  const connected = useMemo(
    () => new Set(data?.channels.map((c) => c.type) ?? []),
    [data],
  );
  const selected = useMemo(
    () => new Set(selectedChannels),
    [selectedChannels],
  );
  const orderedChannels = useMemo(
    () =>
      [...CHANNEL_META].sort(
        (a, b) => Number(selected.has(b.type)) - Number(selected.has(a.type)),
      ),
    [selected],
  );

  return (
    <div className="space-y-5">
      <StepHeader
        icon={Phone}
        title="Hubungkan channel pertama"
        desc="Channel pilihan saat daftar ditaruh paling atas. Kredensial Meta bisa diisi sekarang atau nanti."
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <ul className="space-y-3">
          {orderedChannels.map((meta) => {
            const isConnected = connected.has(meta.type);
            const isSelected = selected.has(meta.type);
            const Icon = meta.icon;
            return (
              <li
                key={meta.type}
                className="flex items-start gap-3 rounded-xl border border-border bg-white p-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">
                      {CHANNEL_LABELS[meta.type]}
                    </p>
                    {isSelected && (
                      <Badge variant="secondary">Pilihan awal</Badge>
                    )}
                    {isConnected && (
                      <Badge variant="success">Terhubung</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {meta.blurb}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={meta.href}>
                    {isConnected ? "Kelola" : "Hubungkan"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        Tombol di atas membuka halaman setup channel di tab yang sama — kembali
        ke wizard ini kapan saja untuk melanjutkan.
      </p>

      <StepFooter onPrev={onPrev} onSkip={onNext} submitLabel="Lanjut" />
    </div>
  );
}

/* ----------------------------- Step: Team ------------------------------ */

function TeamStep({
  workspaceId,
  initialEmails,
  onPrev,
  onNext,
}: {
  workspaceId: string;
  initialEmails: string[];
  onPrev: () => void;
  onNext: () => void;
}) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["members", workspaceId],
    queryFn: () => api.members.list(workspaceId),
  });

  const [drafts, setDrafts] = useState<InviteDraft[]>([
    ...(initialEmails.length > 0
      ? initialEmails.map((email) => ({ email, role: "AGENT" as MemberRole }))
      : [{ email: "", role: "AGENT" as MemberRole }]),
  ]);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [pending, setPending] = useState(false);

  const updateDraft = (i: number, patch: Partial<InviteDraft>) =>
    setDrafts((d) => d.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const addDraft = () =>
    setDrafts((d) => [...d, { email: "", role: "AGENT" }]);

  const removeDraft = (i: number) =>
    setDrafts((d) => (d.length === 1 ? d : d.filter((_, idx) => idx !== i)));

  async function submitAll() {
    const existing = new Set(
      (data?.members ?? []).map((m) => m.user_email.toLowerCase()),
    );
    const toSend = drafts
      .map((d, i) => ({ ...d, i, email: d.email.trim() }))
      .filter(
        (d) => d.email.length > 0 && !existing.has(d.email.toLowerCase()),
      );

    if (toSend.length === 0) {
      onNext();
      return;
    }

    setPending(true);
    setErrors({});
    const nextErrors: Record<number, string> = {};
    for (const row of toSend) {
      try {
        await api.members.invite(workspaceId, {
          email: row.email,
          role: row.role,
        });
      } catch (err) {
        nextErrors[row.i] =
          err instanceof ApiException ? err.message : "Gagal mengundang";
      }
    }
    setPending(false);
    setErrors(nextErrors);
    queryClient.invalidateQueries({ queryKey: ["members", workspaceId] });

    if (Object.keys(nextErrors).length === 0) {
      onNext();
    }
  }

  return (
    <div className="space-y-5">
      <StepHeader
        icon={UsersRound}
        title="Undang tim Anda"
        desc="Tambahkan admin, agent, atau viewer. Jika email sudah memiliki akun, mereka langsung bergabung."
      />

      {data && data.members.length > 0 && (
        <div className="rounded-xl border border-border bg-zinc-50/60 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Sudah ada di workspace ({data.members.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {data.members.map((m) => (
              <Badge key={m.id} variant="secondary">
                {m.user_email} · {m.role}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <ul className="space-y-3">
        {drafts.map((draft, i) => (
          <li key={i} className="space-y-1">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <Input
                  type="email"
                  placeholder="agent@perusahaan.com"
                  value={draft.email}
                  onChange={(e) => updateDraft(i, { email: e.target.value })}
                />
              </div>
              <div className="w-32">
                <Select
                  value={draft.role}
                  onChange={(e) =>
                    updateDraft(i, { role: e.target.value as MemberRole })
                  }
                >
                  {INVITABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={drafts.length === 1}
                onClick={() => removeDraft(i)}
                aria-label="Hapus baris"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {errors[i] && (
              <p className="text-xs text-red-600">{errors[i]}</p>
            )}
          </li>
        ))}
      </ul>

      <Button type="button" size="sm" variant="outline" onClick={addDraft}>
        <Plus className="h-3.5 w-3.5" /> Tambah baris
      </Button>

      <StepFooter
        onPrev={onPrev}
        onSkip={onNext}
        submitLabel="Kirim undangan & lanjut"
        submitting={pending}
        onSubmit={submitAll}
      />
    </div>
  );
}

/* ------------------------------ Step: AI ------------------------------- */

function AIStep({
  workspaceId,
  preferred,
  onPrev,
  onNext,
}: {
  workspaceId: string;
  preferred: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const queryClient = useQueryClient();
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["ai-agent", workspaceId],
    queryFn: () => api.aiAgent.get(workspaceId),
  });

  const [form, setForm] = useState({
    name: "AI Assistant",
    tone: TONES[0],
    language: "id",
    system_prompt:
      "Anda adalah asisten customer service yang membantu menjawab pertanyaan pelanggan dengan jelas dan ringkas.",
    fallback_message:
      "Mohon tunggu sebentar ya, tim kami akan segera membantu.",
  });

  function insertPromptVar(name: string) {
    const ta = promptRef.current;
    const token = `{{${name}}}`;
    if (!ta) {
      setForm((f) => ({ ...f, system_prompt: f.system_prompt + token }));
      return;
    }
    const start = ta.selectionStart ?? form.system_prompt.length;
    const end = ta.selectionEnd ?? form.system_prompt.length;
    const next =
      form.system_prompt.slice(0, start) + token + form.system_prompt.slice(end);
    setForm((f) => ({ ...f, system_prompt: next }));
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + token.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  useEffect(() => {
    if (data) {
      setForm({
        name: data.name,
        tone: data.tone,
        language: data.language,
        system_prompt: data.system_prompt,
        fallback_message: data.fallback_message,
      });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!data) throw new Error("Agent belum siap");
      return api.aiAgent.update(workspaceId, {
        name: form.name,
        tone: form.tone,
        language: form.language,
        system_prompt: form.system_prompt,
        fallback_message: form.fallback_message,
        confidence_threshold: data.confidence_threshold,
        enabled: data.enabled,
        enabled_channel_ids: data.enabled_channel_ids ?? [],
        handoff_enabled: data.handoff_enabled,
        model: data.model,
        embedding_model: data.embedding_model,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-agent", workspaceId] });
      onNext();
    },
  });

  const error =
    mutation.error instanceof ApiException ? mutation.error.message : null;

  if (isLoading || !data) return <Skeleton className="h-80 rounded-xl" />;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="space-y-5"
    >
      <StepHeader
        icon={Bot}
        title="Setel AI Chatbot"
        desc={
          preferred
            ? "Kepribadian dasar agent. Setelah disimpan, prompt perlu disetujui ADMIN sebelum bot membalas pelanggan."
            : "Anda memilih AI nanti saat daftar. Langkah ini bisa dilewati dan diaktifkan kapan saja."
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ob-ai-name">Nama agent</Label>
          <Input
            id="ob-ai-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ob-ai-lang">Bahasa balasan</Label>
          <Select
            id="ob-ai-lang"
            value={form.language}
            onChange={(e) => setForm({ ...form, language: e.target.value })}
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ob-ai-tone">Tone</Label>
        <Select
          id="ob-ai-tone"
          value={form.tone}
          onChange={(e) => setForm({ ...form, tone: e.target.value })}
        >
          {TONES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="ob-ai-prompt">System prompt</Label>
          <span
            className={cn(
              "text-[11px] tabular-nums",
              form.system_prompt.length > AI_PROMPT_LIMIT
                ? "font-semibold text-red-600"
                : "text-muted-foreground",
            )}
          >
            {form.system_prompt.length} / {AI_PROMPT_LIMIT}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-violet-500" /> Preset:
          </span>
          {PROMPT_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() =>
                setForm((f) => ({ ...f, system_prompt: p.prompt }))
              }
              className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[11px] hover:bg-zinc-50"
              title={p.label}
            >
              {p.emoji} {p.label}
            </button>
          ))}
        </div>

        <textarea
          ref={promptRef}
          id="ob-ai-prompt"
          rows={5}
          value={form.system_prompt}
          onChange={(e) =>
            setForm({ ...form, system_prompt: e.target.value })
          }
          className={cn(
            "w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            form.system_prompt.length > AI_PROMPT_LIMIT
              ? "border-red-300"
              : "border-input",
          )}
        />

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">
            Sisipkan variabel:
          </span>
          {AI_VARS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => insertPromptVar(v)}
              className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 font-mono text-[11px] hover:bg-zinc-50"
            >
              {`{{${v}}}`}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ob-ai-fb">Pesan fallback (saat handoff)</Label>
        <textarea
          id="ob-ai-fb"
          rows={2}
          value={form.fallback_message}
          onChange={(e) =>
            setForm({ ...form, fallback_message: e.target.value })
          }
          className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <StepFooter
        onPrev={onPrev}
        onSkip={onNext}
        submitLabel="Simpan & lanjut"
        submitting={mutation.isPending}
      />
    </form>
  );
}

/* ----------------------------- Step: Done ------------------------------ */

function DoneStep({
  completion,
  setupTasks,
  percent,
  onGoStep,
  onRestart,
  onFinish,
}: {
  completion: Completion;
  setupTasks: StepKey[];
  percent: number;
  onGoStep: (k: StepKey) => void;
  onRestart: () => void;
  onFinish: () => void;
}) {
  const allDone = percent === 100;

  const recap: { key: StepKey; icon: typeof Rocket; label: string; hint: string }[] = [
    {
      key: "branding",
      icon: Palette,
      label: "Branding",
      hint: "Nama, warna, timezone",
    },
    {
      key: "channels",
      icon: Phone,
      label: "Channel",
      hint: "WA / IG / Messenger",
    },
    {
      key: "team",
      icon: UsersRound,
      label: "Tim",
      hint: "Anggota di workspace",
    },
    {
      key: "ai",
      icon: Bot,
      label: "AI Chatbot",
      hint: "Aktif & prompt disetujui",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.35, type: "spring" }}
          className={cn(
            "mx-auto flex h-14 w-14 items-center justify-center rounded-full",
            allDone
              ? "bg-emerald-100 text-emerald-600"
              : "bg-amber-100 text-amber-600",
          )}
        >
          {allDone ? (
            <CheckCircle2 className="h-7 w-7" />
          ) : (
            <Sparkles className="h-7 w-7" />
          )}
        </motion.div>

        <h2 className="mt-3 text-lg font-semibold tracking-tight">
          {allDone ? "Workspace siap dipakai" : "Hampir selesai"}
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          {allDone
            ? "Semua langkah selesai. Lanjut ke dashboard atau buka halaman kunci di bawah."
            : `${percent}% siap — lengkapi langkah yang masih kurang untuk hasil maksimal.`}
        </p>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {recap.map((r) => {
          const done = completion[r.key];
          const required = setupTasks.includes(r.key);
          const Icon = r.icon;
          return (
            <li
              key={r.key}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3",
                done || !required
                  ? "border-emerald-200 bg-emerald-50/40"
                  : "border-amber-200 bg-amber-50/40",
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  done || !required
                    ? "bg-emerald-500 text-white"
                    : "bg-amber-500 text-white",
                )}
              >
                {done || !required ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{r.label}</p>
                <p className="truncate text-xs text-muted-foreground">{r.hint}</p>
              </div>
              {!required ? (
                <Badge variant="secondary">Nanti</Badge>
              ) : !done ? (
                <button
                  type="button"
                  onClick={() => onGoStep(r.key)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100"
                >
                  Atur <ArrowRight className="h-3 w-3" />
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="grid gap-3 sm:grid-cols-3">
        <QuickLink
          href="/dashboard/channels"
          icon={Phone}
          label="Channel"
          sub="Hubungkan WA / IG / Messenger"
        />
        <QuickLink
          href="/dashboard/inbox"
          icon={MessageCircle}
          label="Inbox"
          sub="Cek pesan masuk realtime"
        />
        <QuickLink
          href="/dashboard/ai-agent"
          icon={Bot}
          label="AI Chatbot"
          sub="Setujui prompt agar bot aktif"
        />
      </div>

      <div className="flex justify-center gap-2 pt-2">
        <Button variant="outline" onClick={onRestart}>
          <ArrowLeft className="h-4 w-4" /> Ulangi wizard
        </Button>
        <Button onClick={onFinish}>
          Ke dashboard <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
  sub,
}: {
  href: string;
  icon: typeof Rocket;
  label: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-start gap-2 rounded-xl border border-border bg-white p-4 text-left transition-shadow hover:shadow-sm"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
    </Link>
  );
}

/* --------------------------- Shared bits ------------------------------- */

function StepHeader({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof Rocket;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

function StepFooter({
  onPrev,
  onSkip,
  submitLabel,
  submitting,
  onSubmit,
}: {
  onPrev: () => void;
  onSkip: () => void;
  submitLabel: string;
  submitting?: boolean;
  /** If provided, the submit button calls this instead of submitting a form. */
  onSubmit?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
      <Button type="button" variant="ghost" onClick={onPrev}>
        <ArrowLeft className="h-4 w-4" /> Kembali
      </Button>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onSkip}>
          Lewati
        </Button>
        <Button
          type={onSubmit ? "button" : "submit"}
          onClick={onSubmit}
          disabled={submitting}
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
          {!submitting && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
