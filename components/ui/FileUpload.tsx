"use client";
import { useState, useRef } from "react";
import { Upload, FileText, Image as ImageIcon, X, Check } from "lucide-react";

export type UploadedFile = {
  name: string;
  size: number;
  type: string;
  dataUrl: string;
};

export default function FileUpload({
  label = "Upload proof / document",
  helper = "PDF, PNG, JPG up to 10MB",
  accept = ".pdf,image/png,image/jpeg,image/jpg",
  onFileSelect,
  value
}: {
  label?: string;
  helper?: string;
  accept?: string;
  onFileSelect: (file: UploadedFile | null) => void;
  value?: UploadedFile | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [currentFile, setCurrentFile] = useState<UploadedFile | null>(value ?? null);

  function handleFile(file: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const uploaded: UploadedFile = {
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl: dataUrl
      };
      setCurrentFile(uploaded);
      onFileSelect(uploaded);
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    setCurrentFile(null);
    onFileSelect(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-1.5">
      {label && <label className="label">{label}</label>}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
          }
        }}
      />

      {!currentFile ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${
            dragActive
              ? "border-[#ec3013] bg-red-50/30"
              : "border-[var(--color-divider)] hover:border-neutral-400 bg-[var(--color-surface)]"
          }`}
        >
          <div className="flex flex-col items-center justify-center gap-1.5 text-neutral-600">
            <Upload className="h-5 w-5 text-neutral-500" />
            <div className="text-xs font-semibold text-[var(--color-text)]">
              Click to upload <span className="font-normal text-neutral-500">or drag & drop</span>
            </div>
            <p className="text-[11px] text-neutral-400">{helper}</p>
          </div>
        </div>
      ) : (
        <div className="border border-[var(--color-divider)] bg-[var(--color-surface)] p-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid h-8 w-8 place-items-center bg-white border border-[var(--color-divider)] text-neutral-700 flex-shrink-0">
              {currentFile.type.includes("pdf") ? (
                <FileText className="h-4 w-4 text-[#ec3013]" />
              ) : (
                <ImageIcon className="h-4 w-4 text-sky-600" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-[var(--color-text)] truncate max-w-[200px] sm:max-w-xs">
                {currentFile.name}
              </div>
              <div className="text-[10.5px] text-neutral-500 flex items-center gap-1.5">
                <span>{formatSize(currentFile.size)}</span>
                <span>•</span>
                <span className="text-emerald-600 font-medium inline-flex items-center gap-0.5">
                  <Check className="h-3 w-3" /> Ready
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="p-1 hover:bg-neutral-300 transition-colors text-neutral-500 hover:text-neutral-900"
            title="Remove document"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
