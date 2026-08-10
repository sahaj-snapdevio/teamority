"use client";

import { useRouter } from "next/navigation";
import { use, useState } from "react";
import useSWR from "swr";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface WorkspaceMemberRow {
  email: string;
  id: string;
  role: string;
  status: string;
  userEmail: string | null;
  userName: string | null;
}

export default function AdminWorkspaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data } = useSWR(`/api/admin/workspaces/${id}`, fetcher);
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const ws = data?.workspace;
  const members: WorkspaceMemberRow[] = data?.members ?? [];
  const stats = data?.stats ?? { spaces: 0, tasks: 0, comments: 0 };

  async function handleForceDelete() {
    if (confirmName !== ws?.name) {
      return;
    }
    setDeleting(true);
    const res = await fetch(`/api/admin/workspaces/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Force deleted by admin" }),
    });
    if (res.ok) {
      router.push("/admin/workspaces");
    } else {
      setDeleting(false);
    }
  }

  if (!ws) {
    return <div className="p-4 text-base-content/60 sm:p-8">Loading…</div>;
  }

  return (
    <div className="p-4 space-y-8 sm:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{ws.name}</h1>
          <p className="text-base-content/60 text-sm">/{ws.slug}</p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">Force Delete</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Force Delete Workspace</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete <strong>{ws.name}</strong> and all
                its data. Type the workspace name to confirm.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={ws.name}
              value={confirmName}
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-error hover:bg-error/90"
                disabled={confirmName !== ws.name || deleting}
                onClick={handleForceDelete}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Spaces", value: stats.spaces },
          { label: "Tasks", value: stats.tasks },
          { label: "Comments", value: stats.comments },
        ].map(({ label, value }) => (
          <div className="border rounded-lg p-4 text-center" key={label}>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-sm text-base-content/60">{label}</div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">
          Members ({members.length})
        </h2>
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-base-200/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Name</th>
                  <th className="text-left px-4 py-2 font-medium">Email</th>
                  <th className="text-left px-4 py-2 font-medium">Role</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {members.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-4 text-center text-base-content/60"
                      colSpan={4}
                    >
                      No members
                    </td>
                  </tr>
                ) : (
                  members.map((m) => (
                    <tr className="border-t" key={m.id}>
                      <td className="px-4 py-2">{m.userName ?? "—"}</td>
                      <td className="px-4 py-2 text-base-content/60">
                        {m.userEmail ?? m.email ?? "—"}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant="secondary">{m.role}</Badge>
                      </td>
                      <td className="px-4 py-2">{m.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
