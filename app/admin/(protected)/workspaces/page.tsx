"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface AdminWorkspace {
  createdAt: string;
  createdBy: string;
  id: string;
  name: string;
  ownerEmail: string | null;
  ownerName: string | null;
  slug: string;
  status: string;
}

export default function AdminWorkspacesPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // manual debounce
  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => setDebouncedSearch(val), 300);
  };

  const params = new URLSearchParams({ page: String(page) });
  if (debouncedSearch) {
    params.set("search", debouncedSearch);
  }

  const { data, isLoading } = useSWR(
    `/api/admin/workspaces?${params}`,
    fetcher
  );
  const workspaces: AdminWorkspace[] = data?.workspaces ?? [];
  const total: number = data?.total ?? 0;
  const pageSize = 50;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-4 space-y-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-bold">Workspaces</h1>
        <p className="text-base-content/60 text-sm mt-1">
          {total.toLocaleString()} total workspaces
        </p>
      </div>

      <Input
        className="sm:max-w-sm"
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search by name…"
        value={search}
      />

      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-base-200/50">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-left px-4 py-2 font-medium">Owner</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    className="px-4 py-6 text-center text-base-content/60"
                    colSpan={4}
                  >
                    Loading…
                  </td>
                </tr>
              ) : workspaces.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-6 text-center text-base-content/60"
                    colSpan={4}
                  >
                    No workspaces found
                  </td>
                </tr>
              ) : (
                workspaces.map((w) => (
                  <tr className="border-t hover:bg-base-200/30" key={w.id}>
                    <td className="px-4 py-2">
                      <Link
                        className="hover:underline font-medium"
                        href={`/admin/workspaces/${w.id}`}
                      >
                        {w.name}
                      </Link>
                      <div className="text-xs text-base-content/60">
                        {w.slug}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-base-content/60">
                      {w.ownerEmail ?? w.createdBy}
                    </td>
                    <td className="px-4 py-2">
                      <Badge
                        variant={
                          w.status === "ACTIVE" ? "secondary" : "destructive"
                        }
                      >
                        {w.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-base-content/60">
                      {new Date(w.createdAt).toLocaleDateString()}
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
