/** True for email-confirmation callbacks, including legacy Supabase link formats. */
export function isEmailConfirmationCallback(): boolean {
  if (typeof window === "undefined") return false;
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const type = search.get("type") ?? hash.get("type");
  // Password-recovery links deliberately retain their session long enough to set a new password.
  if (search.has("reset") || type === "recovery") return false;
  if (type === "signup" || type === "invite") return true;

  // Older Supabase emails can return either a PKCE code or token fragment without a type label.
  if (search.has("code") || hash.has("access_token") || hash.has("refresh_token")) return true;

  // A legacy link may redirect directly to /dashboard after verification. That navigation originates
  // from this project's Supabase auth host, while normal staff navigation does not.
  try {
    const referrer = new URL(document.referrer);
    return referrer.hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}
