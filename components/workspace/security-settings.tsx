"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { WarningIcon } from "@phosphor-icons/react";
import { deleteWorkspace } from "@/app/actions/workspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

interface SecuritySettingsProps {
  workspaceId: string;
  workspaceName: string;
}

export function SecuritySettings({
  workspaceId,
  workspaceName,
}: SecuritySettingsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  function run(action: () => Promise<{ ok?: true; error?: string } | { error: string }>, onSuccess?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      onSuccess?.();
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="normal-case tracking-normal text-base font-semibold text-destructive">
            Danger Zone
          </CardTitle>
          <CardDescription>
            Deleting the workspace permanently removes all Spaces, Lists, Tasks, comments and files. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog
            open={deleteOpen}
            onOpenChange={(open) => { setDeleteOpen(open); if (!open) setDeleteConfirm(""); }}
          >
            <DialogTrigger asChild>
              <Button variant="destructive" className="gap-2">
                <WarningIcon className="size-4" />
                Delete workspace
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete {workspaceName}?</DialogTitle>
                <DialogDescription>
                  All data will be permanently deleted. There is no recovery period. Type the workspace name to confirm.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="delete-confirm">
                  Type{" "}
                  <span className="normal-case font-semibold tracking-normal">
                    {workspaceName.trim()}
                  </span>{" "}
                  to confirm
                </Label>
                <Input
                  id="delete-confirm"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={pending || deleteConfirm.trim() !== workspaceName.trim()}
                  onClick={() =>
                    run(
                      () => deleteWorkspace({ workspaceId, confirmName: deleteConfirm }),
                      () => { toast.success("Workspace deletion started"); router.push("/onboarding"); },
                    )
                  }
                  className="gap-2"
                >
                  {pending && <Spinner className="size-4" />}
                  Delete forever
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
