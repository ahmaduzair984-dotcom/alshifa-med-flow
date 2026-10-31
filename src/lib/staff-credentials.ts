const STAFF_EMAIL_DOMAIN = "staff.app.alshifa-clinic.workers.dev";

export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(normalizeUsername(value));
}

/** Supabase uses this non-deliverable address internally; staff never see or use it. */
export function usernameToInternalEmail(value: string): string {
  return `${normalizeUsername(value)}@${STAFF_EMAIL_DOMAIN}`;
}

/** Keeps the original administrator account working while staff use usernames. */
export function credentialToAuthEmail(value: string): string | null {
  const credential = value.trim().toLowerCase();
  if (credential.includes("@")) return credential;
  if (!isValidUsername(credential)) return null;
  return usernameToInternalEmail(credential);
}

export function managedUsernameFromEmail(email: string | null | undefined): string | null {
  const suffix = `@${STAFF_EMAIL_DOMAIN}`;
  const normalized = email?.trim().toLowerCase();
  if (!normalized?.endsWith(suffix)) return null;
  return normalized.slice(0, -suffix.length) || null;
}
