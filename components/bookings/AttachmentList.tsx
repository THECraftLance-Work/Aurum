"use client";
import { FileText, Image as ImageIcon, ExternalLink } from "lucide-react";
import { formatDateTime } from "@/lib/utils/format";

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

/**
 * Documents open through /api/documents/[id], which authorises the request and
 * streams the file.
 *
 * This used to mint a Supabase signed URL on click. That URL carries a JWT with
 * an `exp` claim, so reloading the tab, scrolling a PDF (which issues fresh
 * Range requests) or coming back to it later failed with
 * `InvalidJWT: "exp" claim timestamp check failed`. A plain link to our own
 * endpoint has no deadline and stays valid for as long as the user may see it.
 */
export default function AttachmentList({ attachments }: { attachments: Attachment[] }) {
  if (attachments.length === 0) {
    return <p className="text-sm text-slate-500">No documents attached.</p>;
  }

  return (
    <ul className="space-y-2">
      {attachments.map((a) => {
        const isImage = a.mime_type.startsWith("image/");
        return (
          <li key={a.id}>
            <a
              href={`/api/documents/${a.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center gap-3 rounded-xl border border-border px-3.5 py-2.5 text-left transition-all duration-150 hover:border-slate-300 hover:bg-slate-50"
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
              <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
