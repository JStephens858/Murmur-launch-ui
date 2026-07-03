"use client";

import { PaletteIcon } from "lucide-react";
import * as React from "react";

/**
 * Dev-only floating theme picker. Sets data-theme on <html> (variants
 * defined in styles/themes.css) and persists the choice in localStorage.
 * Never rendered in production builds.
 */

const THEMES = [
  { id: "", name: "Murmur (plum)" },
  { id: "teal", name: "Teal accents" },
  { id: "ink", name: "Ink minimal" },
];

const STORAGE_KEY = "murmur-theme-lab";

/* Tiny external store: the source of truth is <html data-theme>. */
let listeners: (() => void)[] = [];

function getTheme() {
  return document.documentElement.dataset.theme ?? "";
}

function setTheme(id: string) {
  if (id) {
    document.documentElement.dataset.theme = id;
  } else {
    delete document.documentElement.dataset.theme;
  }
  localStorage.setItem(STORAGE_KEY, id);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export default function ThemeLab() {
  const theme = React.useSyncExternalStore(
    subscribe,
    getTheme,
    () => "", // server snapshot
  );

  // Re-apply the persisted choice once on mount (store update, not setState).
  React.useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved !== getTheme()) {
      setTheme(saved);
    }
  }, []);

  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <div className="bg-card border-border/60 text-card-foreground fixed right-4 bottom-4 z-[100] flex items-center gap-2 rounded-full border py-1.5 pr-3 pl-2 shadow-xl">
      <PaletteIcon className="text-muted-foreground size-4" />
      <label className="sr-only" htmlFor="theme-lab-select">
        Theme lab
      </label>
      <select
        id="theme-lab-select"
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
        className="bg-transparent text-sm font-medium focus:outline-none"
      >
        {THEMES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}
