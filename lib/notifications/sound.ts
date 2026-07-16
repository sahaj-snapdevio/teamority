"use client";

// Plays a subtle sound for eligible in-app notifications. A single `Audio`
// instance is created lazily on first use and reused for every subsequent
// call — never re-instantiated per notification. Autoplay restrictions or a
// momentarily-missing asset must never throw; `playNotificationSound()` fails
// silently and simply retries cleanly on the next call.

const SOUND_SRC = "/sounds/notification.mp3";
const RATE_LIMIT_MS = 1000;

let audio: HTMLAudioElement | null = null;
let lastPlayedAt = 0;

function getAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") {
    return null;
  }
  if (!audio) {
    audio = new Audio(SOUND_SRC);
    audio.preload = "auto";
  }
  return audio;
}

export function playNotificationSound(): void {
  const now = Date.now();
  if (now - lastPlayedAt < RATE_LIMIT_MS) {
    return;
  }
  const el = getAudio();
  if (!el) {
    return;
  }
  lastPlayedAt = now;
  el.currentTime = 0;
  el.play().catch(() => {
    // Autoplay blocked or asset not yet present — no-op, retry next time.
  });
}
