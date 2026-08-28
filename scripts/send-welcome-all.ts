import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { buildWelcomeEmail } from "@/lib/integrations/templates";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const { data: users, error } = await supabase
    .from("app_users")
    .select("id, email, name, role, status")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ Error fetching users:", error.message);
    process.exit(1);
  }

  if (!users || users.length === 0) {
    console.log("No users found.");
    return;
  }

  console.log(`\n📧 Sending welcome emails to ${users.length} users...\n`);

  let sent = 0, failed = 0;

  for (const u of users) {
    const mail = buildWelcomeEmail(u.name ?? "User", u.email, u.role);

    const { error: insertErr } = await supabase
      .from("notification_deliveries")
      .insert({
        event_key: "WELCOME_EMAIL",
        channel: "EMAIL",
        recipient: u.email,
        entity_type: "user",
        entity_id: u.id,
        subject: mail.subject,
        payload: { html: mail.html, text: mail.text },
        dedupe_key: `WELCOME_EMAIL:user:${u.id}:EMAIL:${u.email}`,
        status: "QUEUED",
        max_attempts: 3
      });

    if (insertErr) {
      console.log(`❌ ${u.email} — ${insertErr.message}`);
      failed++;
    } else {
      console.log(`✅ ${u.email} (${u.name}) — queued welcome email`);
      sent++;
    }
  }

  console.log(`\nDone: ${sent} queued, ${failed} failed`);
}

main().catch((err) => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});