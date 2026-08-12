"use client";

import { TrashIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import {
  deleteUserAction,
  setUserRoleAction,
  toggleUserBanAction,
} from "@/app/actions/orbit-users";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ADMIN_ROLE, USER_ROLE } from "@/config/platform";

export function UserRoleForm({
  role,
  userId,
}: {
  role: string | null;
  userId: string;
}) {
  const nextRole = role === ADMIN_ROLE ? USER_ROLE : ADMIN_ROLE;

  return (
    <form action={setUserRoleAction}>
      <input name="userId" type="hidden" value={userId} />
      <input name="role" type="hidden" value={nextRole} />
      <Button size="sm" type="submit" variant="secondary">
        Make {nextRole}
      </Button>
    </form>
  );
}

export function UserBanForm({
  banned,
  userId,
}: {
  banned: boolean;
  userId: string;
}) {
  return (
    <form action={toggleUserBanAction}>
      <input name="userId" type="hidden" value={userId} />
      <input name="banned" type="hidden" value={String(!banned)} />
      <Button
        size="sm"
        type="submit"
        variant={banned ? "secondary" : "destructive"}
      >
        {banned ? "Unban" : "Ban"}
      </Button>
    </form>
  );
}

export function UserDeleteButton({
  currentUserId,
  email,
  userId,
}: {
  currentUserId: string;
  email: string;
  userId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  if (userId === currentUserId) {
    return null;
  }

  async function confirmDelete() {
    setDeleting(true);
    const result = await deleteUserAction(userId);
    setDeleting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    setOpen(false);
    toast.success(`Deleted ${email}`);
    router.refresh();
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
        variant="destructive"
      >
        Delete
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="min-w-0 sm:max-w-sm text-center">
          <div className="flex min-w-0 flex-col items-center gap-3 pt-2">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-error/10">
              <TrashIcon className="size-6 text-error" weight="fill" />
            </div>
            <div className="w-full min-w-0">
              <DialogTitle className="text-base font-bold">
                Delete User
              </DialogTitle>
              <p className="mt-1 w-full whitespace-normal break-words text-sm text-base-content/60">
                This will permanently delete {email} and all of their personal
                data. This action cannot be undone.
              </p>
            </div>
          </div>
          <div className="mt-2 flex min-w-0 gap-2">
            <Button
              className="flex-1"
              disabled={deleting}
              onClick={() => setOpen(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={deleting}
              onClick={confirmDelete}
              variant="destructive"
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
