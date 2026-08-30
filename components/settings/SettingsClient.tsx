"use client";
import { useEffect, useState } from "react";
import { Bell, CreditCard, Headphones, Ticket, Volume2 } from "lucide-react";
import { playNotificationSound } from "@/lib/utils/notification-client";

export default function SettingsClient() {
  const [sound, setSound] = useState(true);
  const [browser, setBrowser] = useState(false);
  const [browserSupported, setBrowserSupported] = useState(false);
  const [categories, setCategories] = useState({ PAYMENT: true, BOOKING: true, TICKET: true });

  useEffect(() => {
    try {
      setSound(localStorage.getItem("notif_sound") !== "off");
      setCategories({
        PAYMENT: localStorage.getItem("notif_payment") !== "off",
        BOOKING: localStorage.getItem("notif_booking") !== "off",
        TICKET: localStorage.getItem("notif_ticket") !== "off",
      });
    } catch {}
    if (typeof Notification !== "undefined") {
      setBrowserSupported(true);
      setBrowser(Notification.permission === "granted");
    }
  }, []);

  function toggleSound() {
    const next = !sound; setSound(next);
    try { localStorage.setItem("notif_sound", next ? "on" : "off"); } catch {}
  }

  function toggleCategory(category: keyof typeof categories) {
    const next = !categories[category];
    setCategories((current) => ({ ...current, [category]: next }));
    try { localStorage.setItem(`notif_${category.toLowerCase()}`, next ? "on" : "off"); } catch {}
  }

  async function requestBrowser() {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setBrowser(p === "granted");
  }

  const browserBlocked = browserSupported && Notification.permission === "denied";

  return (
    <div className="space-y-3">
      <Row
        icon={<Bell className="h-4 w-4" />}
        title="Browser notifications"
        desc={browser ? "Enabled for this browser" : browserBlocked ? "Blocked in browser settings" : browserSupported ? "Show pop-ups for important events" : "Not supported by this browser"}
        action={browser
          ? <span className="badge bg-emerald-50 text-emerald-700">On</span>
          : <button className="btn-secondary h-9" onClick={requestBrowser} disabled={!browserSupported || browserBlocked}>Enable</button>}
      />
      <div className="border-t border-border pt-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <Headphones className="h-3.5 w-3.5" /> Alert categories
        </div>
        <div className="space-y-2">
          <PreferenceToggle icon={<CreditCard className="h-4 w-4" />} label="Payment updates" enabled={categories.PAYMENT} onToggle={() => toggleCategory("PAYMENT")} />
          <PreferenceToggle icon={<Bell className="h-4 w-4" />} label="Booking updates" enabled={categories.BOOKING} onToggle={() => toggleCategory("BOOKING")} />
          <PreferenceToggle icon={<Ticket className="h-4 w-4" />} label="Support ticket updates" enabled={categories.TICKET} onToggle={() => toggleCategory("TICKET")} />
        </div>
      </div>
    
      <Row
        icon={<Volume2 className="h-4 w-4" />}
        title="Notification sound"
        desc="Play a short sound for high-priority events"
        action={
          <button onClick={toggleSound}
            type="button"
            aria-label={`${sound ? "Disable" : "Enable"} notification sound`}
            aria-pressed={sound}
            className={`h-6 w-11 rounded-full transition ${sound ? "bg-slate-900" : "bg-slate-300"}`}>
            <span className={`block h-5 w-5 rounded-full bg-white shadow transform transition ${sound ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        }
      />
    </div>
  );
}

function PreferenceToggle({ icon, label, enabled, onToggle }: { icon: React.ReactNode; label: string; enabled: boolean; onToggle: () => void }) {
  return <div className="flex items-center justify-between rounded-xl border border-border p-2.5">
    <span className="flex items-center gap-2 text-sm text-slate-700"><span className="text-slate-500">{icon}</span>{label}</span>
    <button type="button" onClick={onToggle} aria-label={`${enabled ? "Disable" : "Enable"} ${label}`} aria-pressed={enabled} className={`h-5 w-9 rounded-full transition ${enabled ? "bg-slate-900" : "bg-slate-300"}`}>
      <span className={`block h-4 w-4 rounded-full bg-white shadow transition ${enabled ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  </div>;
}

function Row({ icon, title, desc, action }: { icon: React.ReactNode; title: string; desc: string; action: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border p-3">
      <div className="flex items-center gap-3">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-600">{icon}</div>
        <div>
          <div className="text-sm font-medium text-slate-900">{title}</div>
          <div className="text-xs text-slate-500">{desc}</div>
        </div>
      </div>
      {action}
    </div>
  );
}
