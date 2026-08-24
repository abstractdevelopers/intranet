"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { ROLES, type Role } from "@/lib/constants";

type ManagedUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  status: string;
};

const ROLE_LABELS: Record<Role, string> = {
  FOUNDER: "Founder",
  SUPER_ADMIN: "Super Admin",
  ACADEMY_ADMIN: "Academy Admin",
  INSTRUCTOR: "Instructor",
  REVIEWER: "Reviewer",
  STUDENT: "Student",
};

export function RoleManager({
  users,
  currentUserId,
  actorIsFounder,
}: {
  users: ManagedUser[];
  currentUserId: string;
  actorIsFounder: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function changeRole(userId: string, role: string) {
    setError(null);
    setPending(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "We couldn't complete that action. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("We couldn't complete that action. Please try again.");
    } finally {
      setPending(null);
    }
  }

  if (users.length === 0) {
    return <div className="mt-4"><EmptyState title="No users found" body="Try a different search." /></div>;
  }

  return (
    <div className="mt-4 space-y-2">
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}
      {users.map((user) => {
        const isSelf = user.id === currentUserId;
        const targetIsFounder = user.role === "FOUNDER";
        const disabled = isSelf || pending === user.id || (targetIsFounder && !actorIsFounder);
        return (
          <div
            key={user.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {user.fullName ?? user.email}
                {isSelf ? <span className="ml-2 text-xs text-text-muted">(you)</span> : null}
              </p>
              <p className="truncate text-xs text-text-muted">{user.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge tone={statusTone(user.status)}>{user.status.toLowerCase()}</Badge>
              <select
                aria-label={`Role for ${user.email}`}
                value={user.role}
                disabled={disabled}
                onChange={(e) => changeRole(user.id, e.target.value)}
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm focus:border-brand-1 focus:outline-2 focus:outline-brand-3 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {(Object.keys(ROLES) as Role[]).map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
              {pending === user.id ? <span className="text-xs text-text-muted">Saving…</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
