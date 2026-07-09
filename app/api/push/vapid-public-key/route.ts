import { NextResponse } from "next/server";
import { env } from "@/lib/env";

// Serves the Web Push VAPID *public* key at runtime so the client can subscribe
// on ANY deployment (bare Node, PM2, Vercel/Railway/Render/Coolify, Docker)
// without a build-time NEXT_PUBLIC_ variable. The public key is not a secret —
// it is designed to be handed to the browser's push service; only the private
// key stays server-side. `no-store` so a runtime key rotation is picked up.
export async function GET() {
  return NextResponse.json(
    { key: env.VAPID_PUBLIC_KEY ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
