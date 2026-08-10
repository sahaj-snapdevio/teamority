"use client";

import * as React from "react";
import { getListStatuses } from "@/app/actions/list";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ListStatusesSettings } from "./list-statuses-settings";

interface Status {
  color: string;
  dashboardCategory: "OPEN" | "WORKING" | "REVIEW" | "COMPLETED";
  id: string;
  name: string;
  orderIndex: number;
  type: "OPEN" | "ACTIVE" | "CLOSED";
}

interface ManageStatusesDialogProps {
  listId: string;
  onOpenChange: (open: boolean) => void;
  onSaved?: (statuses: Status[]) => void;
  open: boolean;
  spaceId: string;
  workspaceId: string;
}

export function ManageStatusesDialog({
  open,
  onOpenChange,
  workspaceId,
  spaceId,
  listId,
  onSaved,
}: ManageStatusesDialogProps) {
  const [statuses, setStatuses] = React.useState<Status[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      return;
    }
    setLoading(true);
    getListStatuses(workspaceId, spaceId, listId).then((res) => {
      if (!("error" in res)) {
        setStatuses(res);
      }
      setLoading(false);
    });
  }, [open, workspaceId, spaceId, listId]);

  function handleClose(val: boolean) {
    if (!val) {
      onSaved?.(statuses);
    }
    onOpenChange(val);
  }

  return (
    <Dialog onOpenChange={handleClose} open={open}>
      <DialogContent className="flex flex-col max-h-[80vh]">
        <DialogHeader className="shrink-0">
          <DialogTitle>Manage Statuses</DialogTitle>
        </DialogHeader>
        <div
          className="overflow-y-auto flex-1 pr-1"
          onWheel={(e) => e.stopPropagation()}
        >
          {loading ? (
            <div className="py-8 text-center text-sm text-base-content/60">
              Loading…
            </div>
          ) : (
            <ListStatusesSettings
              initialStatuses={statuses}
              listId={listId}
              onStatusesChange={setStatuses}
              spaceId={spaceId}
              workspaceId={workspaceId}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
