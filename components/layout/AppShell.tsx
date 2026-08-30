"use client";
import { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { ToastProvider } from "@/components/ui/Toast";
import type { SessionUser } from "@/lib/auth/session";

export default function AppShell({
  user,
  children,
  pendingVerification = 0
}: {
  user: SessionUser;
  children: React.ReactNode;
  pendingVerification?: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-bg">
        <Sidebar
          user={user}
          mobileOpen={open}
          onMobileClose={() => setOpen(false)}
          pendingVerification={pendingVerification}
        />
        {/* Main content area — fixed left-pad matching sidebar width */}
        <div className="flex-1 lg:pl-72 min-w-0 bg-bg">
          <Header user={user} onMenu={() => setOpen(true)} />
          <main className="mx-auto min-w-0 max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
