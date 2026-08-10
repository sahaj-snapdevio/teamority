import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { LOGO_PATH, PRODUCT_NAME } from "@/config/platform";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="force-light min-h-screen bg-base-100 text-base-content">
      <header className="border-b border-base-300">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link className="flex items-center gap-2" href="/">
            <Image
              alt={PRODUCT_NAME}
              className="h-7 w-auto object-contain"
              height={32}
              priority
              src={LOGO_PATH}
              width={150}
            />
          </Link>
          <Link
            className="text-sm font-medium text-base-content/60 transition-colors hover:text-base-content"
            href="/login"
          >
            Sign in
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">{children}</main>
    </div>
  );
}
