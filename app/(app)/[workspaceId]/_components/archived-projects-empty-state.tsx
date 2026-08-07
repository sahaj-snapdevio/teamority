"use client";

import { ArchiveIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { unarchiveSpace } from "@/app/actions/space";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useSetTopbar } from "@/lib/topbar-context";
import { SpaceIcon } from "@/components/common/space-icon";

interface ArchivedProject {
  color: string | null;
  logoEmoji: string | null;
  id: string;
  name: string;
}

/**
 * Shown when a workspace has projects but they are ALL archived. Instead of
 * bouncing the user to the create-project onboarding (which locked members out),
 * we keep them in the workspace and let them restore a project right here.
 * Restore is Owner/Admin-only, mirroring the permission model; members see the
 * list read-only and ask an admin.
 */
export function ArchivedProjectsEmptyState({
  workspaceId,
  archived,
  canManage,
}: {
  workspaceId: string;
  archived: ArchivedProject[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [restoringId, setRestoringId] = React.useState<string | null>(null);

  useSetTopbar({ breadcrumbs: [{ label: "Projects" }], title: "Projects" });

  async function restore(spaceId: string) {
    setRestoringId(spaceId);
    const res = await unarchiveSpace(workspaceId, spaceId);
    if (res && "error" in res && res.error) {
      toast.error(res.error);
      setRestoringId(null);
      return;
    }
    toast.success("Project restored");
    // The workspace now has an active project — the home route will open it.
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-xl bg-base-200 text-base-content/60">
          <ArchiveIcon className="size-7" />
        </div>
        <h2 className="mt-5 text-lg font-semibold text-base-content">
          All projects are archived
        </h2>
        <p className="mt-1.5 text-sm text-base-content/60">
          {canManage
            ? "Restore a project below to pick up where you left off, or create a new one with the + in the sidebar."
            : "Ask a workspace owner or admin to restore a project from the archive."}
        </p>

        <div className="mt-6 rounded-xl border text-left">
          <div className="border-b px-4 py-2 text-2xs font-semibold uppercase tracking-wider text-base-content/60">
            Archived projects
          </div>
          <ul className="divide-y">
            {archived.map((p) => (
              <li className="flex items-center gap-2.5 px-4 py-2.5" key={p.id}>
                <SpaceIcon
                  emoji={p.logoEmoji}
                  color={p.color ?? "#6B7280"}
                  size="sm"
                />
                <span className="flex-1 truncate text-sm font-medium">
                  {p.name}
                </span>
                {canManage && (
                  <Button
                    className="gap-2"
                    disabled={restoringId !== null}
                    onClick={() => restore(p.id)}
                    size="sm"
                    variant="outline"
                  >
                    {restoringId === p.id && <Spinner className="size-3.5" />}
                    Restore
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
