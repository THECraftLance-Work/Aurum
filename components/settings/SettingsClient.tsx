"use client";
import { useEffect, useState } from "react";
import { Bell, Volume2 } from "lucide-react";

export default function SettingsClient() {
  const [sound, setSound] = useState(true);
  const [browser, setBrowser] = useState(false);

  useEffect(() => {
    try {
      setSound(localStorage.getItem("notif_sound") !== "off");
    } catch {}
    if (typeof Notification !== "undefined") setBrowser(Notification.permission === "granted");
  }, []);

  function toggleSound() {
    const next = !sound; setSound(next);
    try { localStorage.setItem("notif_sound", next ? "on" : "off"); } catch {}
  }

  async function requestBrowser() {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setBrowser(p === "granted");
  }

  return (
    <div className="space-y-3">
      <Row
        icon={<Bell className="h-4 w-4" />}
        title="Browser notifications"
        desc={browser ? "Enabled" : "Show pop-ups for important events"}
        action={browser
          ? <span className="badge bg-emerald-50 text-emerald-700">On</span>
          : <button className="btn-secondary h-9" onClick={requestBrowser}>Enable</button>}
      />
      <Row
        icon={<Volume2 className="h-4 w-4" />}
        title="Notification sound"
        desc="Play a short sound for high-priority events"
        action={
          <button onClick={toggleSound}
            className={`h-6 w-11 rounded-full transition ${sound ? "bg-slate-900" : "bg-slate-300"}`}>
            <span className={`block h-5 w-5 rounded-full bg-white shadow transform transition ${sound ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        }
      />
    </div>
  );
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
