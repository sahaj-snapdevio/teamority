"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface SettingsNavProps {
  workspaceId: string;
  isOwner: boolean;
}

export function SettingsNav({ workspaceId, isOwner }: SettingsNavProps) {
  const pathname = usePathname();

  const items = [
    { label: "General", href: `/${workspaceId}/settings/general` },
    { label: "Members", href: `/${workspaceId}/settings/members` },
    ...(isOwner ? [{ label: "Security", href: `/${workspaceId}/settings/security` }] : []),
  ];

  return (
    <nav className="flex gap-1 overflow-x-auto overflow-y-hidden md:sticky md:top-6 md:w-[200px] md:shrink-0 md:flex-col md:self-start md:overflow-visible">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors",
            pathname === item.href
              ? "bg-accent font-medium text-accent-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
