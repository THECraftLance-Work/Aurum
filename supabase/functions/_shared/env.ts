/**
 * Env access for the delivery worker.
 *
 * Deno, not Node: `Deno.env.get` rather than `process.env`. SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY are injected automatically by the Edge Runtime;
 * everything else is set with `supabase secrets set`.
 */

const get = (k: string, fallback = "") => Deno.env.get(k) ?? fallback;

export const isDryRun = () => get("INTEGRATIONS_DRY_RUN") === "true";

export const supabaseEnv = () => ({
  url: get("SUPABASE_URL"),
  serviceRoleKey: get("SUPABASE_SERVICE_ROLE_KEY")
});

export const whatsappEnv = () => ({
  phoneNumberId: get("WHATSAPP_PHONE_NUMBER_ID"),
  accessToken: get("WHATSAPP_ACCESS_TOKEN"),
  apiVersion: get("WHATSAPP_API_VERSION", "v23.0"),
  locale: get("WHATSAPP_TEMPLATE_LOCALE", "en")
});

export const gmailEnv = () => ({
  user: get("GMAIL_USER"),
  appPassword: get("GMAIL_APP_PASSWORD"),
  fromName: get("GMAIL_FROM_NAME", "Aurum Ops")
});

/** Real driver only when credentials exist AND we're not in dry-run. */
export function whatsappConfigured() {
  if (isDryRun()) return false;
  const e = whatsappEnv();
  return Boolean(e.phoneNumberId && e.accessToken);
}

export function emailConfigured() {
  if (isDryRun()) return false;
  const e = gmailEnv();
  return Boolean(e.user && e.appPassword);
}
