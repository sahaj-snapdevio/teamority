import Image from "next/image";
import { LOGO_PATH, PRODUCT_NAME } from "@/config/platform";
import { WatermarkBackground } from "./watermark-background";

/**
 * Single-column card used by the secondary auth screens (signup, forgot
 * password, reset password). Mirrors the left half of the /login modal card so
 * the flows feel like one surface.
 */
export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="force-light relative flex min-h-screen items-center justify-center bg-[#eef2ee] p-4 sm:p-6">
      <WatermarkBackground />

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white px-8 py-10 shadow-2xl sm:px-10">
        <div className="mb-8 flex justify-center">
          <Image
            alt={`${PRODUCT_NAME} Logo`}
            className="h-10 w-auto object-contain"
            height={52}
            src={LOGO_PATH}
            width={200}
            priority
          />
        </div>

        <div className="mb-7">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-base-content">
            {title}
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-base-content/70">
            {description}
          </p>
        </div>

        {children}
      </div>
    </div>
  );
}
