"use client";

import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "@phosphor-icons/react";
import * as React from "react";
import { useTheme } from "@/components/theme/theme-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Personal — applies to this account across every workspace, not shared with
// anyone else. Accent color stays a workspace-wide setting (see
// components/workspace/theme-settings-form.tsx).
export function AppearanceSettingsForm() {
  const {
    appearanceMode,
    setAppearance,
    saveAppearanceSettings,
    cancelAppearanceSettings,
    savedAppearance,
  } = useTheme();

  const [saving, setSaving] = React.useState(false);
  const hasChanges = appearanceMode !== savedAppearance;

  async function handleSave() {
    setSaving(true);
    await saveAppearanceSettings();
    setSaving(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Light, dark, or match your system — this is personal to your account
          and only affects what you see.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button
            className={cn(
              "flex items-center gap-3 rounded-xl border p-4 text-left hover:bg-base-200/50 transition-all focus:outline-none cursor-pointer",
              appearanceMode === "light"
                ? "border-primary ring-2 ring-primary/20 bg-base-200"
                : "border-base-300 bg-elevated"
            )}
            onClick={() => setAppearance("light")}
            type="button"
          >
            <div className="p-2 bg-yellow-500/10 text-yellow-500 rounded-lg">
              <SunIcon className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Light</p>
              <p className="text-xs text-base-content/60 truncate">
                Clean light interface
              </p>
            </div>
            {appearanceMode === "light" && (
              <CheckIcon className="size-4 text-primary shrink-0" />
            )}
          </button>

          <button
            className={cn(
              "flex items-center gap-3 rounded-xl border p-4 text-left hover:bg-base-200/50 transition-all focus:outline-none cursor-pointer",
              appearanceMode === "dark"
                ? "border-primary ring-2 ring-primary/20 bg-base-200"
                : "border-base-300 bg-elevated"
            )}
            onClick={() => setAppearance("dark")}
            type="button"
          >
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
              <MoonIcon className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Dark</p>
              <p className="text-xs text-base-content/60 truncate font-normal">
                Sleek dark interface
              </p>
            </div>
            {appearanceMode === "dark" && (
              <CheckIcon className="size-4 text-primary shrink-0" />
            )}
          </button>

          <button
            className={cn(
              "flex items-center gap-3 rounded-xl border p-4 text-left hover:bg-base-200/50 transition-all focus:outline-none cursor-pointer",
              appearanceMode === "auto"
                ? "border-primary ring-2 ring-primary/20 bg-base-200"
                : "border-base-300 bg-elevated"
            )}
            onClick={() => setAppearance("auto")}
            type="button"
          >
            <div className="p-2 bg-base-200 text-base-content/60 rounded-lg">
              <MonitorIcon className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">System</p>
              <p className="text-xs text-base-content/60 truncate font-normal">
                Sync with OS preferences
              </p>
            </div>
            {appearanceMode === "auto" && (
              <CheckIcon className="size-4 text-primary shrink-0" />
            )}
          </button>
        </div>

        <div
          className={cn(
            "flex items-center justify-end gap-3 border-t border-base-300 pt-4 transition-all duration-300",
            hasChanges
              ? "opacity-100 translate-y-0"
              : "opacity-60 pointer-events-none"
          )}
        >
          <span className="text-xs text-base-content/60 mr-auto">
            {hasChanges ? "You have unsaved changes" : "All changes saved"}
          </span>
          <Button
            className="text-xs"
            disabled={!hasChanges || saving}
            onClick={cancelAppearanceSettings}
            size="sm"
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            className="text-xs"
            disabled={!hasChanges || saving}
            onClick={handleSave}
            size="sm"
            variant="default"
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
