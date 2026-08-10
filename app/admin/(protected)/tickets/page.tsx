"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const STATUS_COLORS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  OPEN: "default",
  IN_PROGRESS: "secondary",
  CLOSED: "outline",
};

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "OPEN", label: "Open" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "CLOSED", label: "Closed" },
];

interface AdminTicket {
  assignedTo: string | null;
  category: string;
  createdAt: string;
  id: string;
  status: string;
  subject: string;
  ticketNumber: string;
  userEmail: string | null;
  userId: string;
  userName: string | null;
}

export default function AdminTicketsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page) });
  if (search) {
    params.set("search", search);
  }
  if (status) {
    params.set("status", status);
  }

  const { data, isLoading } = useSWR(`/api/admin/tickets?${params}`, fetcher);
  const tickets: AdminTicket[] = data?.tickets ?? [];
  const total: number = data?.total ?? 0;
  const pageSize = 50;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-4 space-y-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-bold">Support Tickets</h1>
        <p className="text-base-content/60 text-sm mt-1">
          {total.toLocaleString()} tickets
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          className="sm:max-w-sm"
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by subject…"
          value={search}
        />
        <div className="flex gap-1 overflow-x-auto border rounded-md p-1">
          {STATUS_TABS.map((tab) => (
            <button
              className={`shrink-0 px-3 py-1 text-sm rounded transition-colors ${status === tab.key ? "bg-base-content text-base-100" : "hover:bg-base-200"}`}
              key={tab.key}
              onClick={() => {
                setStatus(tab.key);
                setPage(1);
              }}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-base-200/50">
              <tr>
                <th className="text-left px-4 py-2 font-medium">#</th>
                <th className="text-left px-4 py-2 font-medium">Subject</th>
                <th className="text-left px-4 py-2 font-medium">Category</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">
                  Submitted By
                </th>
                <th className="text-left px-4 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    className="px-4 py-6 text-center text-base-content/60"
                    colSpan={6}
                  >
                    Loading…
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-6 text-center text-base-content/60"
                    colSpan={6}
                  >
                    No tickets found
                  </td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr className="border-t hover:bg-base-200/30" key={t.id}>
                    <td className="px-4 py-2 font-mono text-xs text-base-content/60">
                      {t.ticketNumber}
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        className="hover:underline font-medium"
                        href={`/admin/tickets/${t.id}`}
                      >
                        {t.subject}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-base-content/60">
                      {t.category}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={STATUS_COLORS[t.status] ?? "secondary"}>
                        {t.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-base-content/60">
                      {t.userEmail ?? t.userId}
                    </td>
                    <td className="px-4 py-2 text-base-content/60">
                      {new Date(t.createdAt).toLocaleDateString()}
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
