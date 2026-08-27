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

/**
 * Generic SMTP — works with Gmail, your host's mail server, Zoho, an internal
 * relay, anything.
 *
 * SMTP_SECURE must match the port: 465 => true (implicit TLS),
 * 587 => false (STARTTLS upgrade). Mismatching them is the most common cause of
 * a connection that hangs and then times out.
 */
export const smtpEnv = () => ({
  host: get("SMTP_HOST"),
  port: Number(get("SMTP_PORT", "465")),
  secure: get("SMTP_SECURE", "true") === "true",
  user: get("SMTP_USER"),
  password: get("SMTP_PASSWORD"),
  from: get("SMTP_FROM")
});

/** Real driver only when credentials exist AND we're not in dry-run. */
export function whatsappConfigured() {
  if (isDryRun()) return false;
  const e = whatsappEnv();
  return Boolean(e.phoneNumberId && e.accessToken);
}

export function smtpConfigured() {
  if (isDryRun()) return false;
  const e = smtpEnv();
  return Boolean(e.host && e.user && e.password);
}
