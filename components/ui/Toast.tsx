"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type ToastTone = "success" | "error" | "warning" | "info";

export type ToastOptions = {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** ms before auto-dismiss; pass 0 to require manual dismissal */
  duration?: number;
  action?: { label: string; onClick: () => void };
};

type ToastItem = ToastOptions & { id: number; leaving?: boolean };

const ToastContext = createContext<{ toast: (o: ToastOptions) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const TONES: Record<ToastTone, { icon: React.ComponentType<any>; ring: string; iconColor: string }> = {
  success: { icon: CheckCircle2,   ring: "border-emerald-200", iconColor: "text-emerald-600" },
  error:   { icon: XCircle,        ring: "border-rose-200",    iconColor: "text-rose-600" },
  warning: { icon: AlertTriangle,  ring: "border-amber-200",   iconColor: "text-amber-600" },
  info:    { icon: Info,           ring: "border-slate-200",   iconColor: "text-slate-500" }
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    // Mark leaving first so the exit transition can run, then unmount.
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    const t = setTimeout(() => {
      setItems((prev) => prev.filter((x) => x.id !== id));
      timers.current.delete(id);
    }, 180);
    timers.current.set(id, t);
  }, []);

  const toast = useCallback((o: ToastOptions) => {
    const id = nextId.current++;
    const duration = o.duration ?? 4500;
    setItems((prev) => [...prev.slice(-3), { ...o, id }]);
    if (duration > 0) {
      const t = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, t);
    }
  }, [dismiss]);

  useEffect(() => {
    const map = timers.current;
    return () => { map.forEach(clearTimeout); map.clear(); };
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2"
        role="region"
        aria-label="Notifications"
      >
        {items.map((t) => {
          const tone = TONES[t.tone ?? "info"];
          const Icon = tone.icon;
          return (
            <div
              key={t.id}
              role="status"
              aria-live="polite"
              className={cn(
                "pointer-events-auto flex items-start gap-3 rounded-2xl border bg-white p-3.5 shadow-pop transition-all duration-200 ease-out-quint",
                tone.ring,
                t.leaving ? "translate-x-2 opacity-0" : "animate-slide-in-right"
              )}
            >
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone.iconColor)} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900">{t.title}</div>
                {t.description && (
                  <div className="mt-0.5 text-xs leading-relaxed text-slate-600 break-words">{t.description}</div>
                )}
                {t.action && (
                  <button
                    onClick={() => { t.action!.onClick(); dismiss(t.id); }}
                    className="mt-2 text-xs font-semibold text-[#ec3013] hover:underline"
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
