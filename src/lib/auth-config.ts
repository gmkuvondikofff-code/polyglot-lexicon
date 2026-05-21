// Admin auth configuration — flexible mapping for credentials.
// Replace email/password as needed. The 2FA code accepts ANY of `validCodes`
// (default: "123456"). Set `acceptAnyCode` to true to accept any 6-digit input.
export const authConfig = {
  email: "admin@dictionary.app",
  password: "admin123",
  validCodes: ["123456"],
  acceptAnyCode: false,
  sessionKey: "polyglot.admin.session",
};

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(authConfig.sessionKey) === "1";
}

export function setAuthenticated(v: boolean) {
  if (typeof window === "undefined") return;
  if (v) window.localStorage.setItem(authConfig.sessionKey, "1");
  else window.localStorage.removeItem(authConfig.sessionKey);
}
