/**
 * Theme + appearance, resolved before the first paint.
 *
 * The database (`workspace.theme` / `workspace.appearance_mode`) is the source of
 * truth. It is mirrored into a cookie so the ROOT layout — which renders `<html>`
 * but knows nothing about the current workspace — can emit `class="dark"` and
 * `data-theme=…` in the server HTML. The colours are then correct on the very
 * first frame, instead of being patched in by JS after hydration (which is what
 * made the page flash white).
 *
 * Colour values live in `app/globals.css` as `:root[data-theme]` /
 * `.dark[data-theme]` rules — deliberately NOT as inline styles injected from
 * JS, for the same reason.
 */

export type AppearanceMode = "light" | "dark" | "auto";

export const DEFAULT_THEME = "forest";
export const DEFAULT_APPEARANCE: AppearanceMode = "auto";

/** `theme|appearance`, e.g. `indigo|dark`. */
export const THEME_COOKIE = "kanbanica_theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export interface ThemePreference {
  theme: string;
  appearance: AppearanceMode;
}

const APPEARANCES: readonly string[] = ["light", "dark", "auto"];

/** Must match the `[data-theme]` rules in app/globals.css. */
export const THEME_IDS: readonly string[] = [
  "forest",
  "indigo",
  "black",
  "purple",
  "blue",
  "pink",
  "violet",
  "orange",
  "teal",
  "bronze",
  "mint",
];

export function serializeThemeCookie(pref: ThemePreference): string {
  return `${pref.theme}|${pref.appearance}`;
}

/**
 * Tolerant of a missing or malformed cookie — always returns usable defaults.
 * The cookie is attacker-controlled, so both halves are validated against a
 * whitelist before they are rendered into an HTML attribute.
 */
export function parseThemeCookie(value: string | undefined | null): ThemePreference {
  const [theme, appearance] = (value ?? "").split("|");
  return {
    theme: THEME_IDS.includes(theme) ? theme : DEFAULT_THEME,
    appearance: APPEARANCES.includes(appearance)
      ? (appearance as AppearanceMode)
      : DEFAULT_APPEARANCE,
  };
}

/**
 * Whether the server can commit to a `dark` class in the initial HTML.
 * `auto` depends on the client's `prefers-color-scheme`, which the server cannot
 * know — that one case is resolved by the small blocking script in the root layout.
 */
export function resolvesToDarkOnServer(appearance: AppearanceMode): boolean {
  return appearance === "dark";
}
