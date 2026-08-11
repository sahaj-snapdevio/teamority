import { HouseIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-xl bg-base-200 text-base-content/60">
          <HouseIcon className="size-7" />
        </div>
        <h1 className="mt-5 text-lg font-semibold text-base-content">
          Page not found
        </h1>
        <p className="mt-1.5 text-sm text-base-content/60">
          The page you're looking for doesn't exist or may have been moved.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">Go back home</Link>
        </Button>
      </div>
    </div>
  );
}
