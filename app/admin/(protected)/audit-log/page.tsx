"use client";

import { useState } from "react";
import useSWR from "swr";
import { Input } from "@/components/ui/input";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Shape of a row returned by GET /api/admin/audit-log — a JSON-serialized
// `auditLogs` table row (see db/schema/audit-logs.ts), so `createdAt` comes
// back as an ISO string rather than a `Date`.
interface AuditLogEntry {
  action: string;
  actorEmail: string | null;
  actorId: string | null;
  createdAt: string;
  description: string;
  entityId: string | null;
  entityType: string;
  id: string;
}

export default function AdminAuditLogPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page) });
  if (search) {
    params.set("search", search);
  }

  const { data, isLoading } = useSWR(`/api/admin/audit-log?${params}`, fetcher);
  const logs: AuditLogEntry[] = data?.logs ?? [];
  const total: number = data?.total ?? 0;
  const pageSize = 50;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-4 space-y-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-base-content/60 text-sm mt-1">
          {total.toLocaleString()} entries
        </p>
      </div>

      <Input
        className="max-w-sm"
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        placeholder="Search by action…"
        value={search}
      />

      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-base-200/50">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Timestamp</th>
                <th className="text-left px-4 py-2 font-medium">Action</th>
                <th className="text-left px-4 py-2 font-medium">Actor</th>
                <th className="text-left px-4 py-2 font-medium">Entity</th>
                <th className="text-left px-4 py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    className="px-4 py-6 text-center text-base-content/60"
                    colSpan={5}
                  >
                    Loading…
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-6 text-center text-base-content/60"
                    colSpan={5}
                  >
                    No entries found
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr className="border-t hover:bg-base-200/30" key={log.id}>
                    <td className="px-4 py-2 text-base-content/60 whitespace-nowrap text-xs">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {log.action}
                    </td>
                    <td className="px-4 py-2 text-base-content/60 text-xs">
                      {log.actorEmail ?? log.actorId ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      <span className="text-base-content/60">
                        {log.entityType}
                      </span>
                      {log.entityId && (
                        <span className="text-base-content/60">
                          {" "}
                          / {log.entityId.slice(0, 8)}…
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-base-content/60 text-xs">
                      {log.description}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 border rounded text-sm disabled:opacity-50"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            type="button"
          >
            Previous
          </button>
          <span className="text-sm text-base-content/60">
            Page {page} of {totalPages}
          </span>
          <button
            className="px-3 py-1 border rounded text-sm disabled:opacity-50"
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            type="button"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
