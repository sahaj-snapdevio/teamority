"use client";

import { CopyIcon, LinkIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  disableInviteLink,
  regenerateInviteLink,
  setInviteLinkRole,
} from "@/app/actions/workspace";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { InviteLinkRole } from "@/db/schema/workspace";

interface InviteLinkCardProps {
  appUrl: string;
  /** Owners/Admins may manage the link; everyone else sees a read-only view. */
  canManage: boolean;
  inviteLinkRole: InviteLinkRole;
  inviteLinkToken: string | null;
  workspaceId: string;
}

const ROLE_OPTIONS: { value: InviteLinkRole; label: string }[] = [
  { value: "MEMBER", label: "Member" },
  { value: "GUEST", label: "Guest" },
];

export function InviteLinkCard({
  workspaceId,
  inviteLinkToken,
  inviteLinkRole,
  appUrl,
  canManage,
}: InviteLinkCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [regenerateOpen, setRegenerateOpen] = useState(false);

  const inviteUrl = inviteLinkToken
    ? `${appUrl}/join/${inviteLinkToken}`
    : null;

  function run(
    action: () => Promise<{ ok?: true; error?: string } | { error: string }>,
    onSuccess?: () => void
  ) {
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

  async function copyLink() {
    if (!inviteUrl) {
      return;
    }
    await navigator.clipboard.writeText(inviteUrl);
    toast.success("Invite link copied");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="normal-case tracking-normal text-base font-semibold">
          Invite via link
        </CardTitle>
        <CardDescription>
          Anyone with this link can join the workspace after signing in. It
          never expires — disable or regenerate it at any time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {inviteUrl ? (
          <>
            <div className="flex gap-2">
              <Input className="font-mono text-xs" readOnly value={inviteUrl} />
              <Button
                aria-label="Copy link"
                onClick={copyLink}
                size="icon"
                variant="outline"
              >
                <CopyIcon className="size-4" />
              </Button>
            </div>

            {canManage && (
              <div className="flex flex-wrap items-center gap-2">
                <Label className="text-xs text-muted-foreground">
                  Joins as
                </Label>
                <Select
                  disabled={pending}
                  onValueChange={(value) =>
                    run(
                      () =>
                        setInviteLinkRole(workspaceId, value as InviteLinkRole),
                      () => toast.success("Invite link role updated")
                    )
                  }
                  value={inviteLinkRole}
                >
                  <SelectTrigger
                    aria-label="Invite link role"
                    className="w-[140px]"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="p-1.5">
                    {ROLE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {canManage && (
              <div className="flex gap-2">
                <Dialog onOpenChange={setRegenerateOpen} open={regenerateOpen}>
                  <DialogTrigger asChild>
                    <Button disabled={pending} variant="outline">
                      Regenerate
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Regenerate invite link?</DialogTitle>
                      <DialogDescription>
                        This will immediately invalidate the current link.
                        Anyone with the old link will no longer be able to join.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button
                        onClick={() => setRegenerateOpen(false)}
                        variant="outline"
                      >
                        Cancel
                      </Button>
                      <Button
                        className="gap-2"
                        disabled={pending}
                        onClick={() =>
                          run(
                            () => regenerateInviteLink(workspaceId),
                            () => {
                              setRegenerateOpen(false);
                              toast.success("New invite link generated");
                            }
                          )
                        }
                      >
                        {pending && <Spinner className="size-4" />}
                        Regenerate link
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => disableInviteLink(workspaceId),
                      () => toast.success("Invite link disabled")
                    )
                  }
                  variant="outline"
                >
                  Disable link
                </Button>
              </div>
            )}
          </>
        ) : canManage ? (
          <Button
            className="gap-2"
            disabled={pending}
            onClick={() =>
              run(
                () => regenerateInviteLink(workspaceId),
                () => toast.success("Invite link enabled")
              )
            }
          >
            {pending ? (
              <Spinner className="size-4" />
            ) : (
              <LinkIcon className="size-4" />
            )}
            Enable invite link
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            No invite link is active. An owner or admin can enable one.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
