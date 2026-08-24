"use client";

import { useEffect, useSyncExternalStore } from "react";

type Theme = "light" | "dark" | "system";

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

  const options: { value: Theme; label: string }[] = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "system", label: "System" },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5 text-xs font-medium"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          role="radio"
          aria-checked={theme === opt.value}
          onClick={() => select(opt.value)}
          className={`rounded-md px-2.5 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-brand-1 ${
            theme === opt.value
              ? "bg-brand-1 text-white"
              : "text-text-muted hover:text-text"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
