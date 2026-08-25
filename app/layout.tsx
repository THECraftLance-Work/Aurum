import "./globals.css";
import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import OfflineBanner from "@/components/ui/OfflineBanner";

/**
 * Self-hosted at build time by next/font — no render-blocking request to
 * fonts.googleapis.com, no layout shift, and the CSS variables below are
 * consumed by tailwind.config.ts.
 */
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-archivo"
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-jetbrains-mono"
});

export const metadata: Metadata = {
  title: "Aurum — Real Estate Operations",
  description: "Internal operations platform for Aurum Real Estate.",
  icons: { icon: "/favicon.svg" }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-[var(--color-bg)] text-[var(--color-text)] antialiased font-sans">
        {children}
        <OfflineBanner />
      </body>
    </html>
  );
}
