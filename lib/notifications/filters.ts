// Shared "Event" filter definitions for the notification Inbox — maps each
// user-facing event category to the concrete `triggerType` strings stored on
// notifications (see NOTIFICATION_TRIGGERS in ./types). Used by both the client
// (to render the Event dropdown) and the API route (to translate a selected
// event into a `triggerType IN (...)` condition), so the two never drift.

// Notifications per page (Gmail-style "51–100 of 300" pagination). Shared by
// the client (range label + page-size math) and the API route (`.limit()`),
// so the two never drift.
export const NOTIFICATIONS_PAGE_SIZE = 50;

export const EVENT_FILTERS: {
  value: string;
  label: string;
  triggers: string[];
}[] = [
  { value: "assigned", label: "Assigned", triggers: ["task_assigned"] },
  { value: "unassigned", label: "Unassigned", triggers: ["task_unassigned"] },
  {
    value: "mentioned",
    label: "Mentioned",
    triggers: ["mention_comment", "mention_description"],
  },
  {
    value: "commented",
    label: "Commented",
    triggers: ["comment_added", "comment_reply"],
  },
  {
    value: "status_changed",
    label: "Status changed",
    triggers: ["task_status_changed"],
  },
  {
    value: "priority_changed",
    label: "Priority changed",
    triggers: ["task_priority_changed"],
  },
  {
    value: "due_date",
    label: "Due date",
    triggers: [
      "task_due_date_changed",
      "due_date_reminder_1day",
      "due_date_today",
      "task_overdue",
    ],
  },
  { value: "completed", label: "Completed", triggers: ["task_completed"] },
  { value: "created", label: "Created", triggers: ["task_created"] },
  {
    value: "attachments",
    label: "Attachments",
    triggers: ["attachment_added"],
  },
];

// value → triggerType[] lookup, for the API route.
export const EVENT_TRIGGERS: Record<string, string[]> = Object.fromEntries(
  EVENT_FILTERS.map((e) => [e.value, e.triggers])
);
