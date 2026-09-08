"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function CollapsibleCard({
  title,
  children,
  defaultOpen = true,
  right,
  collapsible = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  right?: React.ReactNode;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!collapsible) {
    return (
      <div className="card p-0 overflow-hidden">
        <div className="flex w-full items-center justify-between px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {right ? <span className="flex items-center gap-2">{right}</span> : null}
        </div>
        <div className="px-5 pb-5 pt-0">{children}</div>
      </div>
    );
  }
  return (
    <div className="card p-0 overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)} className="flex w-full items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <span className="flex items-center gap-2">
          {right}
          <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      <div className={`grid transition-all duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <div className="px-5 pb-5 pt-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
