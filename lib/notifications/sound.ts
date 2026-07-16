"use client";

// Plays a subtle sound for eligible in-app notifications. A single `Audio`
// instance is created lazily on first use and reused for every subsequent
// call — never re-instantiated per notification. Autoplay restrictions or a
// momentarily-missing asset must never throw; `playNotificationSound()` fails
// silently and simply retries cleanly on the next call.
//
// Sound plays independently of tab focus/visibility (Slack-style) — a
// backgrounded or minimized tab still makes noise. When several Kanbanica
// tabs are open for the same user, every tab receives the same SSE event, so
// a Web Locks-based leader election picks exactly one tab to actually play:
// the lock is held for that tab's lifetime and released automatically by the
// browser on close/crash/refresh, letting another open tab take over with no
// heartbeat/polling required.

const SOUND_SRC = "/sounds/notification.mp3";
const RATE_LIMIT_MS = 2000;
const LEADER_LOCK_NAME = "kanbanica:notification-sound-leader";

// Pinned to `globalThis` (same reasoning as lib/sse-clients.ts) so a dev-only
// Fast Refresh re-execution of this module doesn't request the lock a second
// time — the first request never resolves, so a second one would just queue
// forever behind it and this tab would never see itself become leader again.
const globalForSound = globalThis as unknown as {
  __soundIsLeader?: boolean;
  __soundLeaderRequested?: boolean;
};

function electLeader(): void {
  if (globalForSound.__soundLeaderRequested) {
    return;
  }
  globalForSound.__soundLeaderRequested = true;
  if (typeof navigator === "undefined" || !navigator.locks) {
    // No Web Locks support — fail open, every tab plays its own sound.
    globalForSound.__soundIsLeader = true;
    return;
  }
  navigator.locks.request(LEADER_LOCK_NAME, () => {
    globalForSound.__soundIsLeader = true;
    // Never resolves — holds the lock for this tab's lifetime. The browser
    // releases it automatically on tab close/navigation/crash, letting the
    // next open tab acquire it.
    return new Promise(() => {
      /* held until this tab is gone */
    });
  });
}

if (typeof window !== "undefined") {
  electLeader();
}

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
  if (!globalForSound.__soundIsLeader) {
    return;
  }
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
