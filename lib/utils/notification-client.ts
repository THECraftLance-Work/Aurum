"use client";

const SOUND_KEY = "notif_sound";
const CATEGORY_KEYS = {
  PAYMENT: "notif_payment",
  BOOKING: "notif_booking",
  TICKET: "notif_ticket",
} as const;

export function isNotificationSoundEnabled() {
  try { return localStorage.getItem(SOUND_KEY) !== "off"; } catch { return true; }
}

export function isNotificationCategoryEnabled(category: string) {
  const key = CATEGORY_KEYS[category as keyof typeof CATEGORY_KEYS];
  if (!key) return true;
  try { return localStorage.getItem(key) !== "off"; } catch { return true; }
}

/** Uses Web Audio instead of shipping an audio asset. It is intentionally
 * short and only runs for high-priority realtime events or a manual test. */
export function playNotificationSound() {
  if (typeof window === "undefined" || !isNotificationSoundEnabled()) return;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(1480, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(1980, context.currentTime + 0.14);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.075, context.currentTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.2);
  oscillator.addEventListener("ended", () => void context.close());
}

export function showBrowserNotification(title: string, body: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  new Notification(title, { body, tag: `aurum-${Date.now()}` });
}
