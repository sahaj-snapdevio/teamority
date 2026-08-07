import { Skeleton } from "@/components/ui/skeleton";

function FieldRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3 border-b last:border-b-0">
      <div className="flex items-center gap-2 w-32 shrink-0">
        <Skeleton className="size-3.5 rounded-full" />
        <Skeleton className="h-3.5 w-16 rounded" />
      </div>
      <Skeleton className="h-6 w-28 rounded-full" />
    </div>
  );
}

function ActivitySkeletonItems() {
  return (
    <div className="space-y-5">
      {/* Comment item */}
      <div className="flex gap-3">
        <Skeleton className="size-7 rounded-full shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3.5 w-20 rounded" />
            <Skeleton className="h-3 w-14 rounded" />
          </div>
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      </div>

      {/* Activity log item */}
      <div className="flex gap-3 items-start">
        <Skeleton className="size-7 rounded-full shrink-0" />
        <div className="flex-1 space-y-1.5 pt-0.5">
          <Skeleton className="h-3.5 w-3/4 rounded" />
          <Skeleton className="h-3 w-16 rounded" />
        </div>
      </div>

      {/* Comment item */}
      <div className="flex gap-3">
        <Skeleton className="size-7 rounded-full shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3.5 w-24 rounded" />
            <Skeleton className="h-3 w-14 rounded" />
          </div>
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>

      {/* Activity log item */}
      <div className="flex gap-3 items-start">
        <Skeleton className="size-7 rounded-full shrink-0" />
        <div className="flex-1 space-y-1.5 pt-0.5">
          <Skeleton className="h-3.5 w-2/3 rounded" />
          <Skeleton className="h-3 w-20 rounded" />
        </div>
      </div>

      {/* Activity log item */}
      <div className="flex gap-3 items-start">
        <Skeleton className="size-7 rounded-full shrink-0" />
        <div className="flex-1 space-y-1.5 pt-0.5">
          <Skeleton className="h-3.5 w-4/5 rounded" />
          <Skeleton className="h-3 w-12 rounded" />
        </div>
      </div>
    </div>
  );
}

export function TaskDetailSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Top bar — desktop/tablet (`md:`+), mirrors the loaded page's `hidden
        md:flex` top bar. */}
      <div className="hidden md:flex items-center gap-3 border-b px-5 py-3 shrink-0">
        <Skeleton className="size-7 rounded-md shrink-0" />
        <div className="flex items-center gap-2">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="size-3 rounded" />
          <Skeleton className="h-4 w-48 rounded" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-6 w-20 rounded-md" />
          <Skeleton className="h-6 w-16 rounded-md" />
          <Skeleton className="size-7 rounded-md" />
        </div>
      </div>

      {/* Compact header — mobile only, mirrors the loaded page's `md:hidden`
        header (back, title, prev/next, overflow). */}
      <div className="flex md:hidden items-center gap-2 border-b px-2 py-2 shrink-0">
        <Skeleton className="size-9 rounded-md shrink-0" />
        <Skeleton className="h-4 flex-1 rounded" />
        <Skeleton className="size-9 rounded-md shrink-0" />
      </div>

      {/* Two-column body — mirrors the stacking breakpoint used by the loaded
        page (flex-col below `lg`, flex-row at `lg`+) so the skeleton doesn't
        flash a different layout than the content that replaces it. */}
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden lg:flex-row">
        {/* ── Left: main content ── */}
        <div className="flex-1 min-w-0 overflow-y-auto px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
          {/* Mobile hero + compact Properties (< md) */}
          <div className="md:hidden">
            <Skeleton className="h-7 w-3/4 rounded-lg mb-3" />
            <div className="flex items-center gap-2 mb-4">
              <Skeleton className="h-9 w-28 rounded-full" />
              <Skeleton className="h-9 w-24 rounded-full" />
            </div>
            <div className="rounded-xl border bg-card mb-4">
              <div className="flex items-center justify-between px-3 py-2.5">
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="size-4 rounded" />
              </div>
              <div className="border-t divide-y divide-border/60">
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <Skeleton className="h-3 w-14 rounded" />
                  <Skeleton className="h-5 w-32 rounded-full" />
                </div>
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <Skeleton className="h-3 w-14 rounded" />
                  <Skeleton className="h-4 w-28 rounded" />
                </div>
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <Skeleton className="h-3 w-14 rounded" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </div>
            </div>
          </div>

          {/* Desktop/tablet title (`md:`+) */}
          <div className="hidden md:block">
            <Skeleton className="h-8 w-3/4 rounded-lg mb-5" />

            {/* Fields card */}
            <div className="rounded-lg border bg-card px-4 mb-6">
              <FieldRowSkeleton />
              <FieldRowSkeleton />
              <FieldRowSkeleton />
              <FieldRowSkeleton />
              <FieldRowSkeleton />
            </div>
          </div>

          {/* Description label */}
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="h-4 w-24 rounded" />
          </div>

          {/* Description body */}
          <div className="rounded-lg border bg-card p-4 mb-6 space-y-2.5">
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-5/6 rounded" />
            <Skeleton className="h-4 w-4/6 rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-2/3 rounded" />
          </div>

          {/* Activity/comments — mobile only (< md), mirrors the loaded
            page's isMobile-gated feed placed right after Description. */}
          <div className="md:hidden mb-6">
            <Skeleton className="h-20 w-full rounded-lg mb-5" />
            <ActivitySkeletonItems />
          </div>

          {/* Attachments section */}
          <div className="rounded-lg border bg-card p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-4 w-24 rounded" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
            </div>
          </div>

          {/* Checklist section */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="ml-auto h-2 w-32 rounded-full" />
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Skeleton className="size-4 rounded" />
                <Skeleton className="h-4 w-full rounded" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="size-4 rounded" />
                <Skeleton className="h-4 w-4/5 rounded" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="size-4 rounded" />
                <Skeleton className="h-4 w-3/5 rounded" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: activity sidebar (`md:`+ only) ── */}
        <div className="hidden min-h-0 w-full border-t md:flex md:flex-1 md:flex-col overflow-hidden lg:w-80 lg:flex-none lg:border-t-0 lg:border-l xl:w-96">
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {/* Comment composer */}
            <Skeleton className="h-20 w-full rounded-lg mb-5" />

            <ActivitySkeletonItems />
          </div>

          {/* Footer */}
          <div className="border-t px-5 py-3 shrink-0">
            <Skeleton className="h-3.5 w-40 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
