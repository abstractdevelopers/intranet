import { NextResponse } from "next/server";

/**
 * Self-service signup is closed — the academy is private, so accounts are issued
 * by staff (see /api/admin/students). Kept as an explicit 403 rather than a 404 so
 * any stale client or bookmark gets a clear answer instead of a routing error.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Account creation is managed by the academy. Please contact the UCA team to get access.",
    },
    { status: 403 }
  );
}