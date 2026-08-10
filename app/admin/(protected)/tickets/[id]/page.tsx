"use client";

import { use, useState } from "react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const STATUS_OPTIONS = ["OPEN", "IN_PROGRESS", "CLOSED"] as const;

interface TicketMessage {
  authorId: string;
  authorName: string | null;
  body: string;
  createdAt: string;
  id: string;
  isAdmin: boolean;
  isInternalNote: boolean;
}

export default function AdminTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, mutate } = useSWR(`/api/admin/tickets/${id}`, fetcher);
  const [reply, setReply] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [sending, setSending] = useState(false);

  const ticket = data?.ticket;
  const messages: TicketMessage[] = data?.messages ?? [];

  async function handleReply() {
    if (!reply.trim()) {
      return;
    }
    setSending(true);
    await fetch(`/api/admin/tickets/${id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: reply, isInternalNote }),
    });
    setReply("");
    await mutate();
    setSending(false);
  }

  async function handleStatusChange(status: string) {
    await fetch(`/api/admin/tickets/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await mutate();
  }

  if (!ticket) {
    return <div className="p-4 text-base-content/60 sm:p-8">Loading…</div>;
  }

  return (
    <div className="p-4 space-y-6 sm:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs text-base-content/60 font-mono mb-1">
            {ticket.ticketNumber}
          </div>
          <h1 className="text-2xl font-bold">{ticket.subject}</h1>
          <p className="text-base-content/60 text-sm mt-1">
            {ticket.category} · Submitted by {ticket.userEmail ?? ticket.userId}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Select onValueChange={handleStatusChange} value={ticket.status}>
            <SelectTrigger className="h-9 w-40 rounded-md text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem className="text-sm" key={s} value={s}>
                  {s.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        {messages.map((msg) => (
          <div
            className={cn(
              "rounded-lg p-4 border",
              msg.isInternalNote
                ? "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
                : msg.isAdmin
                  ? "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800 ml-3 sm:ml-8"
                  : "bg-base-200/30 mr-3 sm:mr-8"
            )}
            key={msg.id}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {msg.authorName ?? msg.authorId}
                </span>
                {msg.isAdmin && (
                  <Badge className="text-xs" variant="secondary">
                    Admin
                  </Badge>
                )}
                {msg.isInternalNote && (
                  <Badge
                    className="text-xs border-amber-500 text-amber-600"
                    variant="outline"
                  >
                    Internal Note
                  </Badge>
                )}
              </div>
              <span className="text-xs text-base-content/60">
                {new Date(msg.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
          </div>
        ))}
        {messages.length === 0 && (
          <p className="text-center text-base-content/60 py-6">
            No messages yet
          </p>
        )}
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <Textarea
          onChange={(e) => setReply(e.target.value)}
          placeholder="Write a reply…"
          rows={4}
          value={reply}
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              checked={isInternalNote}
              className="rounded"
              onChange={(e) => setIsInternalNote(e.target.checked)}
              type="checkbox"
            />
            Internal Note (not visible to customer)
          </label>
          <Button disabled={!reply.trim() || sending} onClick={handleReply}>
            {sending ? "Sending…" : isInternalNote ? "Add Note" : "Reply"}
          </Button>
        </div>
      </div>
    </div>
  );
}
