import "./globals.css";
import type { Metadata } from "next";
import OfflineBanner from "@/components/ui/OfflineBanner";

export const metadata: Metadata = {
  title: "Aurum — Real Estate Operations",
  description: "Internal operations platform for Aurum Real Estate.",
  icons: { icon: "/favicon.svg" }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[var(--color-bg)] text-[var(--color-text)] antialiased font-sans">
        {children}
        <OfflineBanner />
      </body>
    </html>
  );
}
