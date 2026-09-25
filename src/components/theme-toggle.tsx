"use client";

import { useEffect, useSyncExternalStore } from "react";
import { IconSun, IconMoon, IconMonitor } from "@/components/icons";

type Theme = "light" | "dark" | "system";

const THEME_ICONS = {
  light: IconSun,
  dark: IconMoon,
  system: IconMonitor,
} as const;

const THEME_LABELS: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

function subscribe(callback: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", callback);
  window.addEventListener("storage", callback);
  return () => {
    mq.removeEventListener("change", callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot(): Theme {
  const stored = localStorage.getItem("uca-theme");
  return stored === "light" || stored === "dark" ? stored : "system";
}

function getServerSnapshot(): Theme {
  return "system";
}

function apply(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    apply(theme);
  }, [theme]);

  function select(next: Theme) {
    localStorage.setItem("uca-theme", next);
    apply(next);
    // Notify useSyncExternalStore subscribers (storage events don't fire in the same tab).
    window.dispatchEvent(new Event("storage"));
  }

  const options: Theme[] = ["light", "dark", "system"];

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5"
    >
      {options.map((value) => {
        const Icon = THEME_ICONS[value];
        const isActive = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={THEME_LABELS[value]}
            title={THEME_LABELS[value]}
            onClick={() => select(value)}
            className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-brand-1 ${
              isActive
                ? "bg-brand-1 text-white shadow-sm"
                : "text-text-muted hover:text-text"
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}

