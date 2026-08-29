/**
 * Nudge the delivery worker straight after enqueueing.
 *
 * Why this exists: delivery was relying entirely on migration 0008 — a database
 * webhook plus pg_cron, both reading their URL and key from Supabase Vault. If
 * that migration is not applied, or the Vault secrets are missing, the trigger
 * function no-ops *silently*, so rows pile up as QUEUED and no email is ever
 * sent. That is exactly what happened in production: the Edge Function was
 * deployed and healthy, but nothing was calling it.
 *
 * This calls the function directly using env the web app already has
 * (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY), so the common path
 * needs no Vault entries and no cron. pg_cron remains the retry safety net for
 * anything this misses.
 *
 * Fire-and-forget and never throws: a delivery nudge must not fail a booking.
 */
export function kickDeliveryWorker(): void {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return;

  const url = `${base.replace(/\/$/, "")}/functions/v1/dispatch-notifications`;

  // Short timeout: we are not waiting on delivery, only handing off. If the
  // request is still open when the runtime freezes, pg_cron picks the rows up.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);

  void fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ source: "web-app" }),
    signal: controller.signal,
    cache: "no-store"
  })
    .catch((e) => {
      // Aborting on our own timeout is expected, not an error worth logging.
      if ((e as Error)?.name !== "AbortError") {
        console.error("[outbound] worker kick failed", (e as Error)?.message ?? e);
      }
    })
    .finally(() => clearTimeout(timer));
}
