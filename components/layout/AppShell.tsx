"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { ToastProvider } from "@/components/ui/Toast";
import type { SessionUser } from "@/lib/auth/session";
import PageMotion from "./PageMotion";
import ProjectSelectionShell from "./ProjectSelectionShell";

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
  const [isProjectSelection, setIsProjectSelection] = useState(pathname === "/projects");

  useEffect(() => {
    if (pathname !== "/projects") {
      setIsProjectSelection(false);
      return;
    }
    const hasSelectedProject = document.cookie
      .split("; ")
      .some((cookie) => cookie.startsWith("srivaraha_project=") && cookie.slice("srivaraha_project=".length).length > 0);
    setIsProjectSelection(!hasSelectedProject);
  }, [pathname]);

  if (isProjectSelection) {
    return (
      <ToastProvider>
        <ProjectSelectionShell user={user}>{children}</ProjectSelectionShell>
      </ToastProvider>
    );
  }

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
          <main className="mx-auto min-h-0 w-full min-w-0 max-w-7xl flex-1 overflow-y-auto overflow-x-hidden px-3 pb-24 pt-6 sm:px-6 sm:py-6 xl:px-8 xl:pb-6 xl:pt-6">
            <PageMotion>{children}</PageMotion>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
