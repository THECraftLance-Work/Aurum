"use client";
import { useEffect, useState } from "react";

export default function PremiumLoader({
  message = "Loading Aurum Workspace...",
  submessage = "Securing operations ledger",
  fullscreen = true
}: {
  message?: string;
  submessage?: string;
  fullscreen?: boolean;
}) {
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        const diff = Math.random() * 18;
        return Math.min(prev + diff, 92);
      });
    }, 280);
    return () => clearInterval(timer);
  }, []);

  const content = (
    <div className="flex flex-col items-center justify-center p-8 max-w-sm w-full mx-auto text-center animate-rm-in">
      {/* Animated Glowing Aurum Brand Emblem */}
      <div className="relative mb-7">
        <div className="absolute -inset-2 bg-gradient-to-r from-[#ec3013] to-amber-500 rounded-lg blur-md opacity-40 animate-pulse" />
        <div className="relative grid h-16 w-16 place-items-center bg-[#201e1d] shadow-xl border border-white/10">
          <svg
            width="34"
            height="34"
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="animate-pulse"
          >
            <path
              d="M24 6L38 40H31L28 32.5H20L17 40H10L24 6ZM24 16L21.5 26.5H26.5L24 16Z"
              fill="#ec3013"
            />
            <path
              d="M32.5 15L40 15L42.5 21L35 21L32.5 15Z"
              fill="#ffffff"
            />
          </svg>
          <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-[#ec3013] border-2 border-[#201e1d] animate-ping" />
        </div>
      </div>

      {/* Typography */}
      <div className="space-y-1 mb-6">
        <div className="flex items-center justify-center gap-2">
          <span className="font-heading font-extrabold text-xl tracking-tight text-[#201e1d]">
            AURUM
          </span>
          <span className="text-[9.5px] font-bold tracking-[0.2em] uppercase text-[#ec3013] bg-red-50 border border-red-200/60 px-1.5 py-0.5">
            Operations
          </span>
        </div>
        <h3 className="text-sm font-semibold text-[#201e1d]">{message}</h3>
        {submessage && (
          <p className="text-[11px] text-neutral-500 font-medium tracking-wide uppercase">
            {submessage}
          </p>
        )}
      </div>

      {/* Modernist Shimmering Progress Bar */}
      <div className="w-56 h-1.5 bg-neutral-200 border border-neutral-300/80 overflow-hidden relative shadow-inner">
        <div
          className="h-full bg-gradient-to-r from-[#ec3013] via-amber-500 to-[#ec3013] transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
      </div>

      <div className="mt-3 flex items-center justify-between w-56 text-[10px] text-neutral-400 font-mono">
        <span>ENCRYPTED SESSION</span>
        <span>{Math.round(progress)}%</span>
      </div>
    </div>
  );

  if (!fullscreen) return content;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#f3f2f2]/95 backdrop-blur-md">
      {content}
    </div>
  );
}
