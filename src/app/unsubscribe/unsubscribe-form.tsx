"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Public unsubscribe page. The token comes from the email link and is verified
 * server-side, so someone who forwards the email can also opt out.
 */
export function UnsubscribeForm({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function confirm() {
    setState("busy");
    const res = await fetch("/api/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setState("error");
      setMessage(data.error ?? "We couldn't process that link.");
      return;
    }
    setState("done");
  }

  if (state === "done") {
    return (
      <Card className="p-6">
        <p className="text-base font-semibold">You&apos;re unsubscribed</p>
        <p className="mt-2 text-sm text-text-muted">
          You won&apos;t receive academy announcements any more. Important account emails — like
          password resets and enrollment decisions — will still reach you.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <p className="text-base font-semibold">Unsubscribe from academy emails</p>
      <p className="mt-2 text-sm text-text-muted">
        You&apos;ll stop receiving announcements and updates from Unify Creator Academy. Essential
        account emails will still be delivered.
      </p>
      {message ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{message}</p> : null}
      <div className="mt-4">
        <Button onClick={confirm} disabled={state === "busy"}>
          {state === "busy" ? "Processing…" : "Confirm unsubscribe"}
        </Button>
      </div>
    </Card>
  );
}