"use client";

import { useEffect, useState } from "react";

/**
 * Live countdown to the submission deadline.
 *
 * Rendered from the server's `closesAt` so the client never decides the
 * deadline itself — the server enforces it on every submission regardless. The
 * countdown is only there to make the cut-off visible; when it hits zero the
 * page reloads so the server-rendered "closed" state takes over.
 */
export function AssessmentCountdown({ closesAt }: { closesAt: string }) {
  const target = new Date(closesAt).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      const remaining = target - Date.now();
      if (remaining <= 0) {
        clearInterval(id);
        // Let the server decide what "closed" means — reload into that state.
        window.location.reload();
        return;
      }
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [target]);

  const remaining = target - now;
  if (remaining <= 0) {
    return <span className="font-semibold text-danger">Deadline passed</span>;
  }

  const totalSec = Math.floor(remaining / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const parts = days > 0 ? [`${days}d`, `${hours}h`, `${minutes}m`] : [`${hours}h`, `${minutes}m`, `${seconds}s`];

  return <span className="font-semibold tabular-nums text-text">{parts.join(" ")} left</span>;
}
