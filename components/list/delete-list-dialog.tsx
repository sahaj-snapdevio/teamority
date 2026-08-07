"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { deleteList } from "@/app/actions/list";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DeleteListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  spaceId: string;
  list: { id: string; name: string };
}

export function DeleteListDialog({
  open,
  onOpenChange,
  workspaceId,
  spaceId,
  list,
}: DeleteListDialogProps) {
  const router = useRouter();
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  function handleOpenChange(val: boolean) {
    if (!val) { setConfirm(""); setError(""); }
    onOpenChange(val);
  }

  async function handleDelete() {
    if (confirm !== list.name) return;

    setLoading(true);
    setError("");

    const result = await deleteList(workspaceId, spaceId, list.id);

    setLoading(false);
    if ("error" in result) { setError(result.error); return; }

    handleOpenChange(false);
    router.push(`/${workspaceId}`);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete List</DialogTitle>
          <DialogDescription>
            This will permanently delete <strong>{list.name}</strong> and all its tasks,
            comments, and attachments. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-sm text-base-content/60">
            Consider archiving instead — archived lists can be restored any time.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="delete-confirm" className="flex-wrap sm:flex-nowrap">
              Type{" "}
              <span className="normal-case font-semibold tracking-normal text-base-content">
                {list.name}
              </span>{" "}
              to confirm
            </Label>
            <Input
              id="delete-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && confirm === list.name && !loading) {
                  e.preventDefault();
                  handleDelete();
                }
              }}
              placeholder={list.name}
              autoFocus
              disabled={loading}
            />
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={confirm !== list.name || loading}
            onClick={handleDelete}
          >
            {loading ? "Deleting…" : "Delete List"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
