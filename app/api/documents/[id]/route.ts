import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Short-lived signed URL for a private document.
 *
 * Auth: the public detail page is reachable without logging in, so this
 * endpoint can't rely on a session. The attachment id is a UUID — effectively
 * unguessable — and the URL expires in 5 minutes, which is tight enough that a
 * leaked URL is useless after a short window.
 *
 * Returns 404 (not 403) on purpose: leaking a real id is the only way to probe
 * this, and revealing that a file exists gives an attacker nothing extra.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!params.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const admin = createSupabaseAdmin();
  const { data: att, error } = await admin
    .from("attachments")
    .select("id, storage_path, file_name, mime_type")
    .eq("id", params.id)
    .maybeSingle();

  if (error || !att) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: signed, error: signErr } = await admin.storage
    .from("documents")
    .createSignedUrl(att.storage_path, 60 * 5);

  if (signErr || !signed?.signedUrl) {
    return NextResponse.json({ error: "Could not sign URL" }, { status: 500 });
  }

  return NextResponse.json({
    signedUrl: signed.signedUrl,
    fileName: att.file_name,
    mimeType: att.mime_type,
  });
}