import type { ChannelType } from "@aichat/shared";

export const ONBOARDING_INTENT_KEY = "aichat_onboarding_intent";

const CHANNELS: ChannelType[] = ["whatsapp", "instagram", "messenger"];

export interface OnboardingIntent {
  workspaceName: string;
  brandColor: string;
  timezone: string;
  selectedChannels: ChannelType[];
  aiEnabled: boolean;
  inviteEmails: string[];
  createdAt: number;
}

export function parseEmailList(value: string) {
  return value
    .split(/[\s,;]+/)
    .map((email) => email.trim())
    .filter((email) => email.length > 0 && isValidEmail(email));
}

export function saveOnboardingIntent(intent: OnboardingIntent) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ONBOARDING_INTENT_KEY, JSON.stringify(intent));
}

export function readOnboardingIntent(): OnboardingIntent | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(ONBOARDING_INTENT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<OnboardingIntent>;
    return {
      workspaceName: typeof parsed.workspaceName === "string" ? parsed.workspaceName : "",
      brandColor: typeof parsed.brandColor === "string" ? parsed.brandColor : "#18181b",
      timezone: typeof parsed.timezone === "string" ? parsed.timezone : "Asia/Jakarta",
      selectedChannels: Array.isArray(parsed.selectedChannels)
        ? parsed.selectedChannels.filter(isChannel)
        : [],
      aiEnabled: parsed.aiEnabled !== false,
      inviteEmails: Array.isArray(parsed.inviteEmails)
        ? parsed.inviteEmails.filter((email): email is string => isValidEmail(email))
        : [],
      createdAt:
        typeof parsed.createdAt === "number" ? parsed.createdAt : Date.now(),
    };
  } catch {
    clearOnboardingIntent();
    return null;
  }
}

export function clearOnboardingIntent() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ONBOARDING_INTENT_KEY);
}

function isChannel(value: unknown): value is ChannelType {
  return typeof value === "string" && CHANNELS.includes(value as ChannelType);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
