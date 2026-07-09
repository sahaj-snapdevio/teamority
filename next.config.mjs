import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit a self-contained server (.next/standalone) for lean production/Docker images.
  output: "standalone",
  turbopack: {
    root: resolve(__dirname),
  },
  transpilePackages: ["@emoji-mart/react"],
  // Always revalidate the service worker so a CDN (e.g. Cloudflare, which caches
  // .js by default) or the browser never serves a stale /sw.js after a deploy.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
