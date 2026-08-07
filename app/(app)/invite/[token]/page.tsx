"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircleIcon, XCircleIcon, SpinnerGapIcon } from "@phosphor-icons/react";
import { acceptInvite, declineInvite } from "@/app/actions/workspace";
import { Button } from "@/components/ui/button";

export default function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const router = useRouter();
  const [status, setStatus] = React.useState<
    "idle" | "loading" | "declining" | "success" | "declined" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = React.useState("");
  const [workspaceId, setWorkspaceId] = React.useState("");
  const [token, setToken] = React.useState("");
  // Synchronous in-flight locks — a rapid double click/tap can fire the
  // handler twice before the `disabled` prop takes effect on the next
  // render, which would submit the (single-use) token twice.
  const acceptingRef = React.useRef(false);
  const decliningRef = React.useRef(false);

  React.useEffect(() => {
    params.then((p) => setToken(p.token));
  }, [params]);

  async function handleAccept() {
    if (!token || acceptingRef.current) return;
    acceptingRef.current = true;
    setStatus("loading");
    try {
      const res = await acceptInvite(token);
      if ("error" in res) {
        setStatus("error");
        setErrorMsg(res.error);
      } else {
        setWorkspaceId(res.workspaceId);
        setStatus("success");
      }
    } finally {
      acceptingRef.current = false;
    }
  }

  async function handleDecline() {
    if (!token || decliningRef.current) return;
    decliningRef.current = true;
    setStatus("declining");
    try {
      const res = await declineInvite(token);
      if ("error" in res) {
        setStatus("error");
        setErrorMsg(res.error);
      } else {
        setStatus("declined");
      }
    } finally {
      decliningRef.current = false;
    }
  }

  if (status === "success") {
    return (
      <div className="h-full overflow-auto flex items-center justify-center bg-muted/30 p-4">
        <div className="bg-background rounded-xl border shadow-sm p-8 max-w-sm w-full text-center space-y-4">
          <CheckCircleIcon className="size-12 text-green-500 mx-auto" weight="fill" />
          <h1 className="text-lg font-semibold">You&rsquo;re in!</h1>
          <p className="text-sm text-muted-foreground">You&rsquo;ve successfully joined the workspace.</p>
          <Button className="w-full" onClick={() => router.push(`/${workspaceId}`)}>
            Go to workspace
          </Button>
        </div>
      </div>
    );
  }

  if (status === "declined") {
    return (
      <div className="h-full overflow-auto flex items-center justify-center bg-muted/30 p-4">
        <div className="bg-background rounded-xl border shadow-sm p-8 max-w-sm w-full text-center space-y-4">
          <XCircleIcon className="size-12 text-muted-foreground mx-auto" weight="fill" />
          <h1 className="text-lg font-semibold">Invitation declined</h1>
          <p className="text-sm text-muted-foreground">You&rsquo;ve declined this workspace invitation.</p>
          <Button variant="outline" className="w-full" onClick={() => router.push("/")}>
            Go home
          </Button>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="h-full overflow-auto flex items-center justify-center bg-muted/30 p-4">
        <div className="bg-background rounded-xl border shadow-sm p-8 max-w-sm w-full text-center space-y-4">
          <XCircleIcon className="size-12 text-destructive mx-auto" weight="fill" />
          <h1 className="text-lg font-semibold">Invitation invalid</h1>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
          <Button variant="outline" className="w-full" onClick={() => router.push("/")}>
            Go home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto flex items-center justify-center bg-muted/30 p-4">
      <div className="bg-background rounded-xl border shadow-sm p-8 max-w-sm w-full text-center space-y-4">
        <h1 className="text-lg font-semibold">Workspace invitation</h1>
        <p className="text-sm text-muted-foreground">
          You&rsquo;ve been invited to join a workspace. Click below to accept.
        </p>
        <div className="space-y-2">
          <Button
            className="w-full"
            onClick={handleAccept}
            disabled={status === "loading" || status === "declining" || !token}
          >
            {status === "loading" ? (
              <span className="flex items-center gap-2">
                <SpinnerGapIcon className="size-4 animate-spin" />
                Accepting…
              </span>
            ) : (
              "Accept invitation"
            )}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleDecline}
            disabled={status === "loading" || status === "declining" || !token}
          >
            {status === "declining" ? (
              <span className="flex items-center gap-2">
                <SpinnerGapIcon className="size-4 animate-spin" />
                Declining…
              </span>
            ) : (
              "Decline"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
