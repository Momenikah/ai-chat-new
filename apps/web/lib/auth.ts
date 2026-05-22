/**
 * Lightweight cookie-based token storage.
 *
 * The access token is stored both in a (non-HttpOnly) cookie — so the
 * Next.js middleware can gate `/dashboard` — and is read back by the API
 * client. In production behind HTTPS the cookie is marked `Secure`.
 */

export const ACCESS_TOKEN_COOKIE = "aichat_access_token";
export const REFRESH_TOKEN_COOKIE = "aichat_refresh_token";

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") return;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(
    value,
  )}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

export function storeTokens(accessToken: string, refreshToken: string) {
  // Access token short lived; refresh token longer (7 days).
  setCookie(ACCESS_TOKEN_COOKIE, accessToken, 60 * 60);
  setCookie(REFRESH_TOKEN_COOKIE, refreshToken, 60 * 60 * 24 * 7);
}

export function clearTokens() {
  deleteCookie(ACCESS_TOKEN_COOKIE);
  deleteCookie(REFRESH_TOKEN_COOKIE);
}

export function getAccessToken(): string | null {
  return getCookie(ACCESS_TOKEN_COOKIE);
}

export function getRefreshToken(): string | null {
  return getCookie(REFRESH_TOKEN_COOKIE);
}
