import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const VALID_ROLES = ["DIRECTOR", "ADMIN", "ACCOUNTANT", "SM", "CP"] as const;
type Role = typeof VALID_ROLES[number];

async function listUsers() {
  console.log("\n📋 --- Aurum Real Estate Platform Users ---");
  const { data: users, error } = await supabase
    .from("app_users")
    .select("id, email, name, role, requested_role, status, auth_provider, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ Error fetching users:", error.message);
    return;
  }

  if (!users || users.length === 0) {
    console.log("No users found in app_users table.");
    return;
  }

  console.table(
    users.map((u) => ({
      Email: u.email,
      Name: u.name || "-",
      Role: u.role || "-",
      Requested: u.requested_role || "-",
      Status: u.status,
      Provider: u.auth_provider,
      Joined: new Date(u.created_at).toLocaleDateString()
    }))
  );
  console.log(`Total users: ${users.length}\n`);
}

async function approveUser(email: string) {
  console.log(`\n⏳ Approving user: ${email}...`);
  const { data: user, error: findError } = await supabase
    .from("app_users")
    .select("id, role, requested_role")
    .eq("email", email)
    .maybeSingle();

  if (findError || !user) {
    console.error(`❌ User with email "${email}" not found.`);
    return;
  }

  const roleToSet = user.requested_role || user.role || "SM";

  const { error: updateError } = await supabase
    .from("app_users")
    .update({
      status: "APPROVED",
      role: roleToSet
    })
    .eq("id", user.id);

  if (updateError) {
    console.error("❌ Failed to approve user:", updateError.message);
  } else {
    console.log(`✅ Successfully approved ${email} with role: ${roleToSet}`);
  }
}

async function rejectUser(email: string) {
  console.log(`\n⏳ Rejecting user: ${email}...`);
  const { data: user, error: findError } = await supabase
    .from("app_users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (findError || !user) {
    console.error(`❌ User with email "${email}" not found.`);
    return;
  }

  const { error: updateError } = await supabase
    .from("app_users")
    .update({ status: "REJECTED" })
    .eq("id", user.id);

  if (updateError) {
    console.error("❌ Failed to reject user:", updateError.message);
  } else {
    console.log(`✅ Successfully set ${email} to REJECTED`);
  }
}

async function setRole(email: string, roleInput: string) {
  const role = roleInput.toUpperCase() as Role;
  if (!VALID_ROLES.includes(role)) {
    console.error(`❌ Invalid role "${roleInput}". Valid roles: ${VALID_ROLES.join(", ")}`);
    return;
  }

  console.log(`\n⏳ Setting role "${role}" for ${email}...`);
  const { data: user, error: findError } = await supabase
    .from("app_users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (findError || !user) {
    console.error(`❌ User with email "${email}" not found.`);
    return;
  }

  const { error: updateError } = await supabase
    .from("app_users")
    .update({
      role: role,
      status: "APPROVED"
    })
    .eq("id", user.id);

  if (updateError) {
    console.error("❌ Failed to update role:", updateError.message);
  } else {
    console.log(`✅ Successfully assigned role "${role}" to ${email} (status: APPROVED)`);
  }
}

async function createAdmin(email: string, password: string, name: string, roleInput?: string) {
  const role = (roleInput ? roleInput.toUpperCase() : "DIRECTOR") as Role;
  if (!VALID_ROLES.includes(role)) {
    console.error(`❌ Invalid role "${roleInput}". Valid roles: ${VALID_ROLES.join(", ")}`);
    return;
  }

  console.log(`\n⏳ Creating user account for ${email} with role ${role}...`);

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name }
  });

  let userId = authData?.user?.id;

  if (authError) {
    if (authError.message.includes("already registered") || authError.message.includes("exists")) {
      console.log(`ℹ️ Auth user already exists in Supabase. Looking up user id...`);
      const { data: listData } = await supabase.auth.admin.listUsers();
      const existingAuth = listData.users.find((u) => u.email === email);
      if (existingAuth) {
        userId = existingAuth.id;
      } else {
        console.error("❌ Could not locate existing auth user:", authError.message);
        return;
      }
    } else {
      console.error("❌ Auth creation failed:", authError.message);
      return;
    }
  }

  const { error: dbError } = await supabase.from("app_users").upsert({
    id: userId,
    email: email,
    name: name,
    role: role,
    status: "APPROVED",
    auth_provider: "EMAIL"
  });

  if (dbError) {
    console.error("❌ Failed to save user in app_users:", dbError.message);
  } else {
    console.log(`🎉 User ${email} successfully created/configured!`);
    console.log(`   - ID: ${userId}`);
    console.log(`   - Name: ${name}`);
    console.log(`   - Role: ${role}`);
    console.log(`   - Status: APPROVED`);
  }
}

function printHelp() {
  console.log(`
🏢 Aurum Real Estate Operations - Admin CLI (CLT)
------------------------------------------------
Usage:
  npm run admin list
      List all registered users, roles, and approval status.

  npm run admin approve <email>
      Approve a pending access request for the given email.

  npm run admin reject <email>
      Reject access for the given email.

  npm run admin set-role <email> <DIRECTOR|ADMIN|ACCOUNTANT|SM|CP>
      Assign a specific role to a user and approve them.

  npm run admin create-admin <email> <password> <name> [ROLE]
      Create a new user with verified auth credentials and assign a role (default: DIRECTOR).

Examples:
  npm run admin list
  npm run admin approve hemanth@aurum.com
  npm run admin set-role hemanth@aurum.com DIRECTOR
  npm run admin create-admin admin@aurum.com secretPassword123 "Admin User" DIRECTOR
`);
}

async function main() {
  const [,, command, ...args] = process.argv;

  switch (command) {
    case "list":
    case "ls":
      await listUsers();
      break;

    case "approve":
      if (!args[0]) {
        console.error("❌ Usage: npm run admin approve <email>");
        process.exit(1);
      }
      await approveUser(args[0]);
      break;

    case "reject":
    case "revoke":
      if (!args[0]) {
        console.error("❌ Usage: npm run admin revoke <email>");
        process.exit(1);
      }
      await rejectUser(args[0]);
      break;

    case "set-role":
      if (!args[0] || !args[1]) {
        console.error("❌ Usage: npm run admin set-role <email> <ROLE>");
        process.exit(1);
      }
      await setRole(args[0], args[1]);
      break;

    case "create-admin":
      if (!args[0] || !args[1] || !args[2]) {
        console.error("❌ Usage: npm run admin create-admin <email> <password> <name> [ROLE]");
        process.exit(1);
      }
      await createAdmin(args[0], args[1], args[2], args[3]);
      break;

    case "help":
    case "--help":
    case "-h":
      printHelp();
      break;

    default:
      if (!command) {
        await listUsers();
      } else {
        console.log(`Unknown command: "${command}"`);
        printHelp();
      }
      break;
  }
}

main().catch((err) => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});
