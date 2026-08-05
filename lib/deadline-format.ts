import {
  differenceInCalendarDays,
  format,
  isToday,
  isTomorrow,
  startOfDay,
} from "date-fns";

/** "5 days overdue" / "Due today" / "Due tomorrow" / "Due Mon, Jan 5" — from the date alone. */
export function describeDeadline(dueDate: Date): {
  text: string;
  overdue: boolean;
} {
  const today = startOfDay(new Date());
  if (dueDate < today) {
    const days = differenceInCalendarDays(today, dueDate);
    return {
      text: `${days} day${days === 1 ? "" : "s"} overdue`,
      overdue: true,
    };
  }
  if (isToday(dueDate)) {
    return { text: "Due today", overdue: false };
  }
  if (isTomorrow(dueDate)) {
    return { text: "Due tomorrow", overdue: false };
  }
  return { text: `Due ${format(dueDate, "EEE, MMM d")}`, overdue: false };
}
