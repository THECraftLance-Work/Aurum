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
          onMobileOpen={() => setOpen(true)}
          onMobileClose={() => setOpen(false)}
          pendingVerification={pendingVerification}
        />
        {/* Main content area — fixed left-pad matching sidebar width */}
        <div className="flex min-h-0 flex-1 flex-col xl:pl-72 min-w-0 bg-bg">
          <Header user={user} />
          <main key={pathname} className="mx-auto min-h-0 w-full min-w-0 max-w-7xl flex-1 overflow-x-hidden overflow-y-auto px-3 pb-40 pt-4 animate-fade-in sm:px-6 sm:py-6 xl:overflow-hidden xl:px-8 xl:pb-6 xl:pt-6">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
