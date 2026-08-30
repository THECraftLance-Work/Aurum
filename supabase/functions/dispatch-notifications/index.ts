import { createClient } from "npm:@supabase/supabase-js@2";
import type { DeliveryRow, SendResult } from "../_shared/types.ts";
import { supabaseEnv } from "../_shared/env.ts";
import { sendWhatsAppTemplate } from "../_shared/whatsapp.ts";
import { sendEmail } from "../_shared/email.ts";

/**
 * Outbound delivery worker.
 *
 * Triggered two ways (see migration 0008):
 *   1. A Database Webhook on INSERT into notification_deliveries — near-instant.
 *   2. pg_cron every 5 minutes — the durable safety net for retries and for
 *      anything the webhook missed.
 *
 * Auth is Supabase's own JWT verification: callers present the service-role key
 * as a Bearer token. There is no separate shared secret to manage.
 */

/** Backoff schedule by attempt number. */
const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000];

/** Rows stuck in SENDING for longer than this are considered abandoned. */
const SENDING_STALE_MS = 5 * 60_000;

/** Terminal failures are parked here so the drain stops re-picking them. */
const PARK_MS = 100 * 365 * 86_400_000;

/**
 * Built lazily, not at module scope: createClient() throws on an empty URL, and
 * a module-scope throw kills the isolate at import time — before the handler
 * can return a readable 503. Supabase injects these automatically in
 * production, so this only bites during local `functions serve`.
 */
let _admin: ReturnType<typeof createClient> | null = null;
function getAdmin() {
  if (!_admin) {
    const { url, serviceRoleKey } = supabaseEnv();
    _admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  }
  return _admin;
}

async function deliverOne(row: DeliveryRow): Promise<SendResult> {
  if (row.channel === "WHATSAPP") {
    return sendWhatsAppTemplate({
      to: row.recipient,
      template: row.template_name ?? "",
      bodyParams: row.payload?.bodyParams ?? [],
      urlButtonParam: row.payload?.urlButtonParam
    });
  }
  return sendEmail({
    to: [row.recipient],
    subject: row.subject ?? "Aurum Ops notification",
    html: row.payload?.html ?? "",
    text: row.payload?.text ?? "",
    // Threads every notification about one booking into a single conversation.
    threadKey: row.payload?.threadKey ?? null
  });
}

async function drain(limit = 50) {
  const admin = getAdmin();
  const nowIso = new Date().toISOString();

  // Reclaim rows abandoned mid-flight. Without this, a worker that dies between
  // claiming a row and recording the result leaves it in SENDING forever — the
  // drain only picks up QUEUED/FAILED, so that message would never be retried
  // or reported.
  await admin
    .from("notification_deliveries")
    .update({
      status: "FAILED",
      error_code: "STALE_SENDING",
      error_message: "Abandoned mid-flight; requeued",
      updated_at: nowIso,
      // Push the retry out a minute so a row that keeps stranding cannot
      // hot-loop through the reaper on every pass.
      next_attempt_at: new Date(Date.now() + 60_000).toISOString()
    })
    .eq("status", "SENDING")
    .lt("updated_at", new Date(Date.now() - SENDING_STALE_MS).toISOString());

  const { data: rows, error } = await admin
    .from("notification_deliveries")
    .select("id, event_key, channel, recipient, entity_id, template_name, subject, payload, attempts, max_attempts")
    .in("status", ["QUEUED", "FAILED"])
    .lte("next_attempt_at", nowIso)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[worker] select failed", error.message);
    return { sent: 0, failed: 0, skipped: 0, error: error.message };
  }
  if (!rows?.length) return { sent: 0, failed: 0, skipped: 0 };

  let sent = 0, failed = 0, skipped = 0;

  for (const row of rows as DeliveryRow[]) {
    // Claim the row so a concurrent run can't double-send. The status guard
    // makes this a compare-and-set; dedupe_key is the backstop.
    const { data: claimed } = await admin
      .from("notification_deliveries")
      .update({ status: "SENDING", updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .in("status", ["QUEUED", "FAILED"])
      .select("id");
    if (!claimed?.length) continue;

    const result = await deliverOne(row);
    const attempts = row.attempts + 1;
    const now = new Date().toISOString();

    if (result.ok) {
      const isSkip = Boolean(result.skipped);
      if (isSkip) skipped++; else sent++;
      await admin.from("notification_deliveries").update({
        // A dry run is recorded as SKIPPED, never SENT, so a real delivery is
        // always distinguishable from a no-op at a glance.
        status: isSkip ? "SKIPPED" : "SENT",
        provider: result.provider,
        provider_message_id: result.providerMessageId,
        attempts,
        sent_at: isSkip ? null : now,
        updated_at: now,
        error_code: null,
        error_message: null
      }).eq("id", row.id);
    } else {
      failed++;
      const exhausted = !result.retryable || attempts >= row.max_attempts;
      const backoff = BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)];
      await admin.from("notification_deliveries").update({
        status: "FAILED",
        provider: result.provider,
        attempts: exhausted ? row.max_attempts : attempts,
        // Parking a terminal failure far in the future stops the drain
        // re-picking it every run. (Setting this to `now` would make the row
        // eligible again on the very next pass — an infinite retry loop.)
        next_attempt_at: exhausted
          ? new Date(Date.now() + PARK_MS).toISOString()
          : new Date(Date.now() + backoff).toISOString(),
        error_code: result.errorCode,
        error_message: result.errorMessage,
        updated_at: now
      }).eq("id", row.id);
    }
  }

  return { sent, failed, skipped };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { url, serviceRoleKey } = supabaseEnv();
  if (!url || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Supabase env not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const result = await drain();
    console.info("[worker] drain complete", JSON.stringify(result));
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    const message = String((err as Error)?.message ?? err);
    console.error("[worker] drain threw", message);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
