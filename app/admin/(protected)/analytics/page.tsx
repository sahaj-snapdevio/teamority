import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { env } from "@/lib/env";

interface DailyCount {
  count: number;
  date: string;
}

interface AnalyticsData {
  commentsPerDay: DailyCount[];
  spacesPerDay: DailyCount[];
  tasksPerDay: DailyCount[];
  totals: {
    tasks: number;
    comments: number;
    spaces: number;
  };
}

async function getAnalytics() {
  const base = env.APP_URL;
  const hdrs = await headers();
  const res = await fetch(`${base}/api/admin/analytics/feature-usage`, {
    headers: { cookie: hdrs.get("cookie") ?? "" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Failed to load analytics");
  }
  return res.json();
}

export default async function AdminAnalyticsPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/");
  }

  let data: AnalyticsData;
  try {
    data = await getAnalytics();
  } catch {
    return (
      <div className="p-4 text-red-500 sm:p-8">
        Failed to load analytics data.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-8 sm:p-8">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-base-content/60 text-sm mt-1">
          Platform usage statistics
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Tasks", value: data.totals?.tasks ?? 0 },
          { label: "Total Comments", value: data.totals?.comments ?? 0 },
          { label: "Total Spaces", value: data.totals?.spaces ?? 0 },
        ].map(({ label, value }) => (
          <div
            className="rounded-lg border bg-elevated p-6 text-center shadow-sm"
            key={label}
          >
            <div className="text-4xl font-bold">
              {Number(value).toLocaleString()}
            </div>
            <div className="text-sm text-base-content/60 mt-2">{label}</div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">
          Tasks Created — Last 30 Days
        </h2>
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-base-200/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Date</th>
                  <th className="text-left px-4 py-2 font-medium">
                    Tasks Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {(data.tasksPerDay ?? []).length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-4 text-center text-base-content/60"
                      colSpan={2}
                    >
                      No data
                    </td>
                  </tr>
                ) : (
                  (data.tasksPerDay ?? []).map((row: DailyCount) => (
                    <tr className="border-t" key={row.date}>
                      <td className="px-4 py-2 text-base-content/60">
                        {row.date}
                      </td>
                      <td className="px-4 py-2 font-medium">{row.count}</td>
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
