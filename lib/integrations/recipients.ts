import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { bootstrapRecipients } from "./env";
import { isEmail, toE164 } from "./phone";
import type { EventKey } from "./types";

export type ResolvedRecipients = {
  email: string[];
  whatsapp: string[]; // E.164 with leading '+'
  invalid: { channel: "WHATSAPP" | "EMAIL"; raw: string; reason: string }[];
};

const CACHE_TTL_MS = 60_000;
const cache = new Map<EventKey, { at: number; value: ResolvedRecipients }>();

/**
 * Who receives org-level alerts.
 *
 * Deliberately asymmetric:
 *   EMAIL    — configured rows PLUS every approved Accountant's address.
 *              Internal addresses, no consent problem, self-heals as staff change.
 *   WHATSAPP — configured rows ONLY. Never auto-derived from the user roster:
 *              WhatsApp is billed per conversation and messaging someone's
 *              personal mobile without opt-in is a consent and cost problem.
 */
export async function resolveRecipients(event: EventKey): Promise<ResolvedRecipients> {
  const hit = cache.get(event);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const admin = createSupabaseAdmin();
  const invalid: ResolvedRecipients["invalid"] = [];
  const email = new Set<string>();
  const whatsapp = new Set<string>();

  const { data: rows } = await admin
    .from("notification_recipients")
    .select("channel, destination, events, is_active")
    .eq("is_active", true);

  const configured = (rows ?? []).filter((r: any) => (r.events ?? []).includes(event));

  for (const r of configured) {
    if (r.channel === "EMAIL") {
      if (isEmail(r.destination)) email.add(r.destination.trim().toLowerCase());
      else invalid.push({ channel: "EMAIL", raw: r.destination, reason: "INVALID_EMAIL" });
    } else {
      const p = toE164(r.destination);
      if (p.ok) whatsapp.add(p.e164);
      else invalid.push({ channel: "WHATSAPP", raw: r.destination, reason: p.reason });
    }
  }

  // Bootstrap from env only while the table has no rows for this channel.
  const boot = bootstrapRecipients();
  if (email.size === 0) {
    for (const e of boot.emails) {
      if (isEmail(e)) email.add(e.toLowerCase());
      else invalid.push({ channel: "EMAIL", raw: e, reason: "INVALID_EMAIL" });
    }
  }
  if (whatsapp.size === 0) {
    for (const w of boot.whatsapp) {
      const p = toE164(w);
      if (p.ok) whatsapp.add(p.e164);
      else invalid.push({ channel: "WHATSAPP", raw: w, reason: p.reason });
    }
  }

  // Accountants always get the email copy — they're the verification desk.
  const { data: accountants } = await admin
    .from("app_users")
    .select("email")
    .eq("role", "ACCOUNTANT")
    .eq("status", "APPROVED");
  for (const a of accountants ?? []) {
    if (a.email && isEmail(a.email)) email.add(a.email.toLowerCase());
  }

  const value: ResolvedRecipients = {
    email: [...email],
    whatsapp: [...whatsapp],
    invalid
  };
  cache.set(event, { at: Date.now(), value });
  return value;
}

/** Exposed for tests and for the admin UI to force a refresh after edits. */
export function clearRecipientCache() {
  cache.clear();
}
