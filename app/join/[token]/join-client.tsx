"use client";

import {
  CheckCircleIcon,
  SpinnerGapIcon,
  UsersIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { joinViaLink } from "@/app/actions/workspace";
import { Button } from "@/components/ui/button";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="bg-background rounded-xl border shadow-sm p-8 max-w-sm w-full text-center space-y-4">
        {children}
      </div>
    </div>
  );
}

/** Title-case an enum role like "MEMBER" → "Member". */
function roleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

export function JoinError({ message }: { message: string }) {
  const router = useRouter();
  return (
    <Shell>
      <XCircleIcon className="size-12 text-destructive mx-auto" weight="fill" />
      <h1 className="text-lg font-semibold">Invite link unavailable</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button
        className="w-full"
        onClick={() => router.push("/")}
        variant="outline"
      >
        Go home
      </Button>
    </Shell>
  );
}

export function JoinWorkspaceCard({
  workspaceName,
  role,
  token,
}: {
  workspaceName: string;
  role: string;
  token: string;
}) {
  const router = useRouter();
  const [status, setStatus] = React.useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = React.useState("");
  const [workspaceId, setWorkspaceId] = React.useState("");

  async function handleJoin() {
    setStatus("loading");
    const res = await joinViaLink(token);
    if ("error" in res) {
      setStatus("error");
      setErrorMsg(res.error);
    } else {
      setWorkspaceId(res.workspaceId);
      setStatus("success");
      router.push(`/${res.workspaceId}`);
    }
  }

  if (status === "error") {
    return <JoinError message={errorMsg} />;
  }

  if (status === "success") {
    return (
      <Shell>
        <CheckCircleIcon
          className="size-12 text-green-500 mx-auto"
          weight="fill"
        />
        <h1 className="text-lg font-semibold">You&rsquo;re in!</h1>
        <p className="text-sm text-muted-foreground">
          Taking you to the workspace&hellip;
        </p>
        <Button
          className="w-full"
          onClick={() => router.push(`/${workspaceId}`)}
        >
          Go to workspace
        </Button>
      </Shell>
    );
  }

  return (
    <Shell>
      <UsersIcon className="size-12 text-primary mx-auto" weight="duotone" />
      <h1 className="text-lg font-semibold">Join workspace</h1>
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Workspace</p>
        <p className="text-base font-medium">{workspaceName}</p>
      </div>
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Role</p>
        <p className="text-base font-medium">{roleLabel(role)}</p>
      </div>
      <p className="text-xs text-muted-foreground">Invited via link</p>
      <Button
        className="w-full"
        disabled={status === "loading"}
        onClick={handleJoin}
      >
        {status === "loading" ? (
          <span className="flex items-center gap-2">
            <SpinnerGapIcon className="size-4 animate-spin" />
            Joining&hellip;
          </span>
        ) : (
          "Join workspace"
        )}
      </Button>
    </Shell>
  );
}
