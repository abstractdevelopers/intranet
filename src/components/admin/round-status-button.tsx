"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PEER_BODY_STATUS } from "@/lib/constants";

/** Close or reopen a round. */
export function RoundStatusButton({
  roundId,
  status,
}: {
  roundId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const closing = status === PEER_BODY_STATUS.REVIEWING;

  async function toggle() {
    setBusy(true);
    await fetch(`/api/admin/peer-body/rounds/${roundId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: closing ? PEER_BODY_STATUS.CLOSED : PEER_BODY_STATUS.REVIEWING,
      }),
    }).catch(() => null);
    setBusy(false);
    router.refresh();
  }

  return (
    <Button variant="secondary" onClick={toggle} disabled={busy} type="button" className="px-3 py-1.5 text-xs">
      {busy ? "…" : closing ? "Close round" : "Reopen"}
    </Button>
  );
}
