"use client";
import { useState, useRef } from "react";
import { Upload, FileText, Image as ImageIcon, X, Check, Loader2, AlertCircle } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";

/**
 * A file that has actually been uploaded to the `documents` Storage bucket.
 *
 * Previously this component read the file into a base64 `dataUrl` and handed
 * that to the form — which every API route then silently dropped, so uploads
 * appeared to work and persisted nothing. Now the file is uploaded on select
 * and the caller gets back a real storage path to persist.
 */
export type UploadedFile = {
  storagePath: string;
  name: string;
  size: number;
  type: string;
};

const MAX_BYTES = 10 * 1024 * 1024; // 10MB — matches the bucket's file_size_limit
const ALLOWED = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];

export default function FileUpload({
  label = "Upload proof / document",
  helper = "PDF, PNG, JPG up to 10MB",
  accept = ".pdf,image/png,image/jpeg,image/jpg,image/webp",
  onFileSelect,
  value,
  disabled
}: {
  label?: string;
  helper?: string;
  accept?: string;
  onFileSelect: (file: UploadedFile | null) => void;
  value?: UploadedFile | null;
  disabled?: boolean;
}) {
  const supabase = createSupabaseBrowser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [currentFile, setCurrentFile] = useState<UploadedFile | null>(value ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!file || disabled) return;
    setError(null);

    // Validate client-side for a fast, clear message. The bucket enforces the
    // same limits server-side, so this is convenience, not security.
    if (file.size > MAX_BYTES) {
      setError(`"${file.name}" is ${formatSize(file.size)}. Maximum is 10MB.`);
      return;
    }
    if (file.type && !ALLOWED.includes(file.type)) {
      setError(`${file.type || "That file type"} isn't accepted. Use PDF, PNG, JPG or WebP.`);
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("You appear to be signed out. Reload and try again."); return; }

      // Storage RLS requires the first path segment to be the uploader's id.
      const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
      const storagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`;

      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(storagePath, file, { contentType: file.type || "application/octet-stream", upsert: false });

      if (upErr) {
        setError(upErr.message.includes("Bucket not found")
          ? "Storage isn't set up yet — run migration 0011."
          : upErr.message);
        return;
      }

      const uploaded: UploadedFile = {
        storagePath,
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream"
      };
      setCurrentFile(uploaded);
      onFileSelect(uploaded);
    } catch (e) {
      setError((e as Error)?.message ?? "Upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  }

  async function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    const doomed = currentFile;
    setCurrentFile(null);
    onFileSelect(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    // Best-effort cleanup so an abandoned pick doesn't leave an orphan object.
    if (doomed) {
      await supabase.storage.from("documents").remove([doomed.storagePath]).catch(() => {});
    }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const isImage = currentFile?.type.startsWith("image/");

  return (
    <div className="space-y-1.5">
      {label && <label className="label">{label}</label>}

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled || uploading}
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      {currentFile ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-emerald-600">
            {isImage ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-slate-900">{currentFile.name}</div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-700">
              <Check className="h-3 w-3" /> Uploaded · {formatSize(currentFile.size)}
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-rose-600"
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 transition-all duration-150",
            dragActive
              ? "border-accent bg-accent-light"
              : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100",
            (disabled || uploading) && "cursor-not-allowed opacity-60"
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              <span className="text-sm text-slate-600">Uploading…</span>
            </>
          ) : (
            <>
              <Upload className="h-5 w-5 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">
                Click to upload, or drag a file here
              </span>
              <span className="text-xs text-slate-500">{helper}</span>
            </>
          )}
        </button>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
