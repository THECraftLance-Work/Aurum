"use client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";

/**
 * A table row you can click anywhere on to navigate.
 *
 * Deliberately JS rather than a stretched-link overlay: that technique needs
 * `position: relative` on the <tr> to be its containing block, which engines
 * handle inconsistently — and when it fails the overlay escapes to the card,
 * so every click opens the wrong row.
 *
 * The primary cell should stay a real <a href>, which keeps middle-click,
 * ctrl-click and "open in new tab" working. Interactive children (buttons,
 * other links) are skipped via the closest() check below, so an Approve button
 * inside the row doesn't also navigate.
 */
export default function ClickableRow({
  href,
  children,
  className
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();

  function activate(e: React.MouseEvent | React.KeyboardEvent) {
    const target = e.target as HTMLElement;
    // Let genuine controls handle their own clicks.
    if (target.closest("a,button,input,select,textarea,label,[role='button']")) return;
    // Don't hijack a text selection.
    if (typeof window !== "undefined" && window.getSelection()?.toString()) return;
    router.push(href);
  }

  return (
    <tr
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate(e);
        }
      }}
      tabIndex={0}
      className={cn(
        "row-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40",
        className
      )}
    >
      {children}
    </tr>
  );
}
