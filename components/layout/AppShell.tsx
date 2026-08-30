"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden bg-bg">
        <Sidebar
          user={user}
          mobileOpen={open}
          onMobileClose={() => setOpen(false)}
          pendingVerification={pendingVerification}
        />
        {/* Main content area — fixed left-pad matching sidebar width */}
        <div className="flex min-h-0 flex-1 flex-col lg:pl-72 min-w-0 bg-bg">
          <Header user={user} onMenu={() => setOpen(true)} />
          <main key={pathname} className="mx-auto min-h-0 w-full min-w-0 max-w-7xl flex-1 overflow-hidden px-4 py-6 animate-fade-in sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
