"use client";

import * as React from "react";

interface TopbarState {
  actions?: React.ReactNode;
  breadcrumbs: Array<{
    label: string;
    color?: string | null;
    emoji?: string | null;
    href?: string;
  }>;
  title: string;
}

interface TopbarContextValue {
  setState: (s: TopbarState | null) => void;
  state: TopbarState | null;
}

const TopbarContext = React.createContext<TopbarContextValue>({
  state: null,
  setState: () => {},
});

export function TopbarProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<TopbarState | null>(null);
  return (
    <TopbarContext.Provider value={{ state, setState }}>
      {children}
    </TopbarContext.Provider>
  );
}

export function useTopbarState() {
  return React.useContext(TopbarContext).state;
}

export function useSetTopbar(config: TopbarState) {
  const { setState } = React.useContext(TopbarContext);
  // Stringify to use as stable dep — actions ReactNode excluded from comparison
  const key = JSON.stringify({
    breadcrumbs: config.breadcrumbs,
    title: config.title,
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: config/setState intentionally excluded — config is a fresh object every render, `key` is the stable stand-in used to detect real changes (title/breadcrumbs), and setState is stable from context.
  React.useEffect(() => {
    setState(config);
    return () => setState(null);
  }, [key]);
}
