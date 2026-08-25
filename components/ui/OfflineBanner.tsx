"use client";
import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    function handleOnline() {
      setIsOffline(false);
      setShowRestored(true);
      setTimeout(() => setShowRestored(false), 3000);
    }
    function handleOffline() {
      setIsOffline(true);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (!navigator.onLine) setIsOffline(true);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline && !showRestored) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg transition-all animate-rm-in ${
        isOffline
          ? "bg-slate-900 text-white border border-slate-700"
          : "bg-emerald-600 text-white"
      }`}
    >
      {isOffline ? (
        <>
          <WifiOff className="h-4 w-4 text-amber-400 animate-pulse" />
          <span>You are currently offline. Ledger reconnecting...</span>
        </>
      ) : (
        <>
          <Wifi className="h-4 w-4 text-white" />
          <span>Connection restored! Syncing data.</span>
        </>
      )}
    </div>
  );
}
