import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { env } from "@/lib/env";

interface DashboardData {
  newSignupsThisMonth: number;
  newSignupsToday: number;
  openTickets: number;
  recentActivity: Array<{
    id: string;
    action: string;
    actorId: string | null;
    actorEmail: string | null;
    entityType: string;
    entityId: string | null;
    description: string;
    createdAt: string;
  }>;
  totalTasks: number;
  totalUsers: number;
  totalWorkspaces: number;
}

async function getDashboard(): Promise<DashboardData> {
  const base = env.APP_URL;
  const { headers } = await import("next/headers");
  const hdrs = await headers();
  const res = await fetch(`${base}/api/admin/dashboard`, {
    headers: { cookie: hdrs.get("cookie") ?? "" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Failed to load dashboard");
  }
  return res.json();
}

const STAT_CARDS = [
  { key: "totalUsers", label: "Total Users" },
  { key: "totalWorkspaces", label: "Total Workspaces" },
  { key: "totalTasks", label: "Total Tasks" },
  { key: "openTickets", label: "Open Tickets" },
  { key: "newSignupsToday", label: "Signups Today" },
  { key: "newSignupsThisMonth", label: "Signups This Month" },
] as const;

export default async function AdminDashboardPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/");
  }

  let data: DashboardData;
  try {
    data = await getDashboard();
  } catch {
    return (
      <div className="p-4 text-red-500 sm:p-8">
        Failed to load dashboard data.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-8 sm:p-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-base-content/60 text-sm mt-1">Platform overview</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {STAT_CARDS.map(({ key, label }) => (
          <div
            className="rounded-lg border bg-elevated p-5 shadow-sm"
            key={key}
          >
            <div className="text-sm text-base-content/60">{label}</div>
            <div className="text-3xl font-bold mt-1">
              {(data[key] as number).toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Recent Activity</h2>
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-base-200/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Time</th>
                  <th className="text-left px-4 py-2 font-medium">Action</th>
                  <th className="text-left px-4 py-2 font-medium">Actor</th>
                  <th className="text-left px-4 py-2 font-medium">Entity</th>
                </tr>
              </thead>
              <tbody>
                {data.recentActivity.map((entry) => (
                  <tr className="border-t hover:bg-base-200/30" key={entry.id}>
                    <td className="px-4 py-2 text-base-content/60 whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {entry.action}
                    </td>
                    <td className="px-4 py-2 text-base-content/60">
                      {entry.actorEmail ?? entry.actorId ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-base-content/60">
                      {entry.entityType}
                      {entry.entityId
                        ? ` / ${entry.entityId.slice(0, 8)}…`
                        : ""}
                    </td>
                  </tr>
                ))}
                {data.recentActivity.length === 0 && (
                  <tr>
                    <td
                      className="px-4 py-6 text-center text-base-content/60"
                      colSpan={4}
                    >
                      No activity yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
