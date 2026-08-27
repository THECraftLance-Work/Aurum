"use client";
import { useState } from "react";
import { FileText, Image as ImageIcon, Download, Loader2 } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils/format";
import { useToast } from "@/components/ui/Toast";

type Attachment = {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  label: string | null;
  created_at: string;
  uploader?: { name: string } | null;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AttachmentList({ attachments }: { attachments: Attachment[] }) {
  const supabase = createSupabaseBrowser();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  /**
   * The bucket is private, so there is no permanent URL to link to. We mint a
   * short-lived signed URL on click — which also means Storage RLS is checked
   * at that moment, not at render.
   */
  async function open(a: Attachment) {
    setBusyId(a.id);
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(a.storage_path, 60);

      if (error || !data?.signedUrl) {
        toast({
          tone: "error",
          title: "Could not open the document",
          description: error?.message ?? "The file may have been removed."
        });
        return;
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } finally {
      setBusyId(null);
    }
  }

  if (attachments.length === 0) {
    return <p className="text-sm text-slate-500">No documents attached.</p>;
  }

  return (
    <ul className="space-y-2">
      {attachments.map((a) => {
        const isImage = a.mime_type.startsWith("image/");
        return (
          <li key={a.id}>
            <button
              onClick={() => open(a)}
              disabled={busyId === a.id}
              className="flex w-full items-center gap-3 rounded-xl border border-border px-3.5 py-2.5 text-left transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
                {isImage ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-900">{a.file_name}</div>
                <div className="truncate text-xs text-slate-500">
                  {a.label ? `${a.label} · ` : ""}{formatSize(a.file_size)} · {formatDateTime(a.created_at)}
                  {a.uploader?.name ? ` · ${a.uploader.name}` : ""}
                </div>
              </div>
              {busyId === a.id
                ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />
                : <Download className="h-4 w-4 shrink-0 text-slate-400" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
