import { Skeleton } from "@/components/ui/skeleton";

export default function SpaceSettingsLoading() {
  return (
    <div className="mt-4 rounded-xl border bg-elevated p-6">
      {/* Section heading */}
      <div className="space-y-2">
        <Skeleton className="h-5 w-40 rounded" />
        <Skeleton className="h-3.5 w-48 rounded sm:w-64" />
      </div>

      <div className="mt-6 space-y-3">
        {/* Member / field rows */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            className="flex items-center gap-3 rounded-md border px-3 py-2.5"
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length static skeleton, never reorders
            key={i}
          >
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <div className="min-w-0 space-y-1.5">
              <Skeleton className="h-3.5 w-16 rounded sm:w-36" />
              <Skeleton className="h-3 w-20 rounded sm:w-48" />
            </div>
            <Skeleton className="ml-auto h-7 w-12 shrink-0 rounded-md sm:w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
