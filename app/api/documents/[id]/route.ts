import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Serve a private document.
 *
 * This streams the file rather than handing back a Supabase signed URL.
 *
 * Why: a signed URL carries a JWT with an `exp` claim. Once it lapses, every
 * request fails with `{"error":"InvalidJWT","message":"\"exp\" claim timestamp
 * check failed"}` — which is what users were hitting. It isn't just a matter of
 * picking a longer expiry: a browser PDF viewer issues Range requests while you
 * scroll, and reloading the tab or returning to it later re-requests the same
 * URL. Any of those after the deadline fails. Proxying removes the deadline
 * entirely, so the URL stays valid and reloadable for as long as the user is
 * allowed to see the file.
 *
 * It also fixes an access hole: this endpoint previously had no auth, on the
 * grounds that the profile page was public. That page is now restricted to
 * Admin/Director, so every request is authorised here — mirroring the
 * `attachments` RLS policy, since the admin client bypasses RLS.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!params.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("app_users").select("id, role, status").eq("id", user.id).maybeSingle();
  if (!profile || profile.status !== "APPROVED") {
    return NextResponse.json({ error: "Your account is not approved." }, { status: 403 });
  }

  const admin = createSupabaseAdmin();
  const { data: att, error } = await admin
    .from("attachments")
    .select("id, entity_type, entity_id, storage_path, file_name, mime_type, uploaded_by")
    .eq("id", params.id)
    .maybeSingle();

  if (error || !att) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Mirrors the attachments_read RLS policy.
  const isReviewer = ["ACCOUNTANT", "ADMIN", "DIRECTOR"].includes(profile.role);
  let allowed = isReviewer || att.uploaded_by === profile.id;

  if (!allowed) {
    if (att.entity_type === "booking") {
      const { data } = await admin
        .from("bookings").select("id").eq("id", att.entity_id).eq("created_by", profile.id).maybeSingle();
      allowed = Boolean(data);
    } else if (att.entity_type === "payment") {
      const { data } = await admin
        .from("payments").select("id").eq("id", att.entity_id).eq("submitted_by", profile.id).maybeSingle();
      allowed = Boolean(data);
    } else if (att.entity_type === "ticket") {
      const { data } = await admin
        .from("tickets").select("id").eq("id", att.entity_id).eq("raised_by", profile.id).maybeSingle();
      allowed = Boolean(data);
    }
  }

  // 404 rather than 403: revealing that a given id exists tells an unauthorised
  // caller something they shouldn't learn.
  if (!allowed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: blob, error: dlErr } = await admin.storage
    .from("documents")
    .download(att.storage_path);

  if (dlErr || !blob) {
    return NextResponse.json(
      { error: "The file could not be retrieved. It may have been removed." },
      { status: 502 }
    );
  }

  // Only inline types the browser renders safely. Anything else downloads —
  // rendering arbitrary uploaded content inline on our own origin would be an
  // XSS vector (e.g. an SVG or HTML file carrying script).
  const INLINE = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
  const disposition = INLINE.includes(att.mime_type) ? "inline" : "attachment";
  const safeName = att.file_name.replace(/["\\\r\n]/g, "_");

  return new NextResponse(blob.stream(), {
    headers: {
      "Content-Type": att.mime_type || "application/octet-stream",
      "Content-Length": String(blob.size),
      "Content-Disposition": `${disposition}; filename="${safeName}"`,
      // Private: it's per-user authorised, so no shared cache may keep it.
      "Cache-Control": "private, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
