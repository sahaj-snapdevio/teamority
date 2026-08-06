import { NextResponse } from "next/server";
import { getWebPushSettings } from "@/lib/integration-settings";

// Serves the Web Push VAPID *public* key at runtime so the client can subscribe
// on ANY deployment (bare Node, PM2, Vercel/Railway/Render/Coolify, Docker)
// without a build-time NEXT_PUBLIC_ variable. The public key is not a secret —
// it is designed to be handed to the browser's push service; only the private
// key stays server-side. `no-store` so a runtime key rotation (env or Settings
// → Integrations) is picked up on the next fetch, no rebuild or restart.
export async function GET() {
  const config = await getWebPushSettings();
  return NextResponse.json(
    { key: config?.publicKey ?? null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
