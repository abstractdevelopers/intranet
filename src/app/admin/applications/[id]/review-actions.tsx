"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function ReviewActions({ applicationId, electiveName }: { applicationId: string; electiveName: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"APPROVED" | "REJECTED" | null>(null);

  async function decide(decision: "APPROVED" | "REJECTED") {
    setError(null);
    setLoading(decision);
    try {
      const res = await fetch(`/api/admin/applications/${applicationId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "We couldn't complete that action. Please try again.");
        return;
      }
      router.push("/admin/applications");
      router.refresh();
    } catch {
      setError("We couldn't complete that action. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card>
      <h2 className="text-base font-semibold">Review elective: {electiveName}</h2>
      <p className="mt-1 text-sm text-text-muted">
        Approving grants the student immediate access to this elective. Rejecting keeps it inaccessible.
      </p>
      {error ? (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex gap-3">
        <Button onClick={() => decide("APPROVED")} disabled={loading !== null}>
          {loading === "APPROVED" ? "Approving…" : "Approve elective"}
        </Button>
        <Button variant="danger" onClick={() => decide("REJECTED")} disabled={loading !== null}>
          {loading === "REJECTED" ? "Rejecting…" : "Reject elective"}
        </Button>
      </div>
    </Card>
  );
}
