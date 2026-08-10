"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function useDebounce<T>(value: T, delay: number): T {
  const [dv, setDv] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return dv;
}

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "banned", label: "Banned" },
];

interface AdminUser {
  banned: boolean | null;
  banReason: string | null;
  createdAt: string;
  email: string;
  emailVerified: boolean;
  id: string;
  image: string | null;
  name: string;
  role: string | null;
}

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 300);

  const params = new URLSearchParams({ page: String(page), status });
  if (debouncedSearch) {
    params.set("search", debouncedSearch);
  }

  const { data, isLoading } = useSWR(`/api/admin/users?${params}`, fetcher);

  const users: AdminUser[] = data?.users ?? [];
  const total: number = data?.total ?? 0;
  const pageSize = 50;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-4 space-y-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-base-content/60 text-sm mt-1">
          {total.toLocaleString()} total users
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          className="sm:max-w-sm"
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by name or email…"
          value={search}
        />
        <div className="flex gap-1 border rounded-md p-1">
          {STATUS_TABS.map((tab) => (
            <button
              className={`px-3 py-1 text-sm rounded transition-colors ${status === tab.key ? "bg-base-content text-base-100" : "hover:bg-base-200"}`}
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
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-left px-4 py-2 font-medium">Email</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">Role</th>
                <th className="text-left px-4 py-2 font-medium">Joined</th>
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
              ) : users.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-6 text-center text-base-content/60"
                    colSpan={5}
                  >
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    className="border-t hover:bg-base-200/30 cursor-pointer"
                    key={u.id}
                  >
                    <td className="px-4 py-2">
                      <Link
                        className="hover:underline font-medium"
                        href={`/admin/users/${u.id}`}
                      >
                        {u.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-base-content/60">
                      {u.email}
                    </td>
                    <td className="px-4 py-2">
                      {u.banned ? (
                        <Badge variant="destructive">Banned</Badge>
                      ) : (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {u.role === "admin" ? (
                        <Badge>Admin</Badge>
                      ) : (
                        <span className="text-base-content/60">User</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-base-content/60">
                      {new Date(u.createdAt).toLocaleDateString()}
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
