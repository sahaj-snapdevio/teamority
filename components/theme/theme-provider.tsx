"use client";

import * as React from "react";
import { toast } from "sonner";
import { updateAppearanceMode } from "@/app/actions/profile";
import { updateWorkspaceTheme } from "@/app/actions/workspace";
import {
  type AppearanceMode,
  serializeThemeCookie,
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
} from "@/lib/theme";

export interface ThemeContextType {
  appearanceMode: "light" | "dark" | "auto";
  // Accent color (workspace-wide) and appearance (personal) are independent
  // settings, saved/cancelled independently, even though they share one DOM
  // application step and one cookie.
  cancelAppearanceSettings: () => void;
  cancelThemeSettings: () => void;
  currentTheme: string;
  saveAppearanceSettings: () => Promise<void>;
  savedAppearance: "light" | "dark" | "auto";
  savedTheme: string;
  saveThemeSettings: () => Promise<void>;
  setAppearance: (mode: "light" | "dark" | "auto") => void;
  setTheme: (theme: string) => void;
}

const ThemeContext = React.createContext<ThemeContextType | undefined>(
  undefined
);

interface ThemeProviderProps {
  children: React.ReactNode;
  /** The current USER's own appearance preference (`user.appearanceMode`) — not workspace state. */
  initialAppearanceMode: "light" | "dark" | "auto";
  /** The WORKSPACE's accent color (`workspace.theme`) — shared across every member. */
  initialTheme: string;
  workspaceId: string;
}

export function ThemeProvider({
  children,
  workspaceId,
  initialTheme,
  initialAppearanceMode,
}: ThemeProviderProps) {
  // The database is the source of truth. There is no localStorage fallback: it
  // was written only on an explicit Save, so it silently drifted from the DB and
  // the pre-paint script trusted it — that mismatch is what flashed white.
  const [savedTheme, setSavedTheme] = React.useState<string>(initialTheme);
  const [savedAppearance, setSavedAppearance] = React.useState<AppearanceMode>(
    initialAppearanceMode
  );

  // Actively rendered values (can be previewed immediately)
  const [currentTheme, setCurrentThemeState] =
    React.useState<string>(initialTheme);
  const [appearanceMode, setAppearanceModeState] =
    React.useState<AppearanceMode>(initialAppearanceMode);

  /**
   * Reflect the choice onto <html>. Colours themselves come from the
   * `:root[data-theme]` / `.dark[data-theme]` rules in globals.css, so this only
   * has to set two attributes — nothing is computed or injected here.
   */
  const applyThemeToDOM = React.useCallback(
    (theme: string, appearance: AppearanceMode) => {
      if (typeof window === "undefined") {
        return;
      }

      const root = document.documentElement;
      const isDark =
        appearance === "dark" ||
        (appearance === "auto" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);

      root.classList.toggle("dark", isDark);
      root.dataset.theme = theme;
      root.dataset.appearance = appearance;
    },
    []
  );

  // Mirror the DB value into a cookie so the ROOT layout can render the right
  // `class`/`data-theme` on the very next request, before any JS runs.
  const persistCookie = React.useCallback(
    (theme: string, appearance: AppearanceMode) => {
      // biome-ignore lint/suspicious/noDocumentCookie: CookieStore is unsupported in Safari/Firefox; this must work everywhere.
      document.cookie = `${THEME_COOKIE}=${serializeThemeCookie({ theme, appearance })}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax`;
    },
    []
  );

  // Seed the cookie from the DB on first visit in this browser. Without this the
  // very first load of a workspace has no cookie to read.
  React.useEffect(() => {
    persistCookie(initialTheme, initialAppearanceMode);
  }, [initialTheme, initialAppearanceMode, persistCookie]);

  // Update DOM when preview theme/appearance states change
  React.useEffect(() => {
    applyThemeToDOM(currentTheme, appearanceMode);

    // Listen for system appearance changes if currently in auto mode
    if (appearanceMode === "auto") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => {
        applyThemeToDOM(currentTheme, "auto");
      };

      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, [currentTheme, appearanceMode, applyThemeToDOM]);

  // Immediate preview callbacks
  const setTheme = React.useCallback((theme: string) => {
    setCurrentThemeState(theme);
  }, []);

  const setAppearance = React.useCallback((mode: "light" | "dark" | "auto") => {
    setAppearanceModeState(mode);
  }, []);

  // Permanent save — accent color (workspace-wide, admin-only).
  const saveThemeSettings = React.useCallback(async () => {
    try {
      const res = await updateWorkspaceTheme({
        workspaceId,
        theme: currentTheme,
      });

      if (res && "error" in res) {
        toast.error(res.error);
        return;
      }

      setSavedTheme(currentTheme);
      // Mirror the freshly-saved DB value so the next server render agrees.
      persistCookie(currentTheme, appearanceMode);

      toast.success("Theme color saved successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save theme color");
    }
  }, [workspaceId, currentTheme, appearanceMode, persistCookie]);

  // Permanent save — appearance mode (personal, any user).
  const saveAppearanceSettings = React.useCallback(async () => {
    try {
      const res = await updateAppearanceMode(appearanceMode);

      if (res && "error" in res) {
        toast.error(res.error);
        return;
      }

      setSavedAppearance(appearanceMode);
      persistCookie(currentTheme, appearanceMode);

      toast.success("Appearance saved successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save appearance");
    }
  }, [appearanceMode, currentTheme, persistCookie]);

  // Revert preview back to saved baseline values
  const cancelThemeSettings = React.useCallback(() => {
    setCurrentThemeState(savedTheme);
    toast.info("Changes discarded");
  }, [savedTheme]);

  const cancelAppearanceSettings = React.useCallback(() => {
    setAppearanceModeState(savedAppearance);
    toast.info("Changes discarded");
  }, [savedAppearance]);

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        appearanceMode,
        setTheme,
        setAppearance,
        saveThemeSettings,
        saveAppearanceSettings,
        cancelThemeSettings,
        cancelAppearanceSettings,
        savedTheme,
        savedAppearance,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
