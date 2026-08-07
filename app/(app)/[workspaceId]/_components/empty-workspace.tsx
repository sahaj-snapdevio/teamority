"use client";

import { FolderOpenIcon } from "@phosphor-icons/react";
import { useSetTopbar } from "@/lib/topbar-context";

/**
 * Shown to a workspace member (typically a GUEST) who has been added to the
 * workspace but not yet to any project. A guest cannot create projects, so
 * rather than bounce them to the create-project onboarding wizard (which they
 * can't complete), we land them inside the workspace shell with this friendly
 * empty state.
 */
export function EmptyWorkspace({ workspaceName }: { workspaceName: string }) {
  useSetTopbar({ breadcrumbs: [{ label: "Projects" }], title: "Projects" });

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-xl bg-base-200 text-base-content/60">
        <FolderOpenIcon className="size-7" />
      </div>
      <h2 className="mt-5 text-lg font-semibold text-base-content">
        No projects yet
      </h2>
      <p className="mt-1.5 max-w-sm text-sm text-base-content/60">
        You haven&rsquo;t been added to any projects in {workspaceName}. Ask a
        workspace owner or admin to add you to a project to get started.
      </p>
    </div>
  );
}
