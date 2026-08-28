"use client";
import { useId, useState } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Lightweight CSS-only tooltip.
 *
 * Used to reveal the full value of a truncated table cell, so long strings can
 * be clipped without losing information. Renders nothing extra when `label` is
 * empty, so it's safe to wrap optional fields.
 */
export default function Tooltip({
  label,
  children,
  side = "top",
  className
}: {
  label?: string | null;
  children: React.ReactNode;
  side?: "top" | "bottom";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  if (!label) return <>{children}</>;

  return (
    <span
      className={cn("relative inline-flex max-w-full", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined} className="min-w-0 max-w-full">
        {children}
      </span>
      <span
        id={id}
        role="tooltip"
        className={cn(
          // text-left: the bubble is absolutely positioned but still inherits
          // text-align from its cell, which right-aligns it in numeric columns.
          "pointer-events-none absolute left-1/2 z-50 w-max max-w-xs -translate-x-1/2 rounded-xl bg-slate-900 px-2.5 py-1.5 text-left text-xs font-normal leading-snug text-white shadow-pop transition-all duration-150 ease-out-quint",
          "whitespace-normal break-words",
          side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
          open ? "opacity-100 translate-y-0" : "opacity-0 invisible",
          side === "top" && !open && "translate-y-1",
          side === "bottom" && !open && "-translate-y-1"
        )}
      >
        {label}
      </span>
    </span>
  );
}
