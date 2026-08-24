import { requireRoleManager } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { RoleManager } from "./role-manager";

export const metadata = { title: "Settings" };

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const actor = await requireRoleManager();
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const users = await db.user.findMany({
    where: query
      ? {
          OR: [
            { email: { contains: query, mode: "insensitive" } },
            { profile: { fullName: { contains: query, mode: "insensitive" } } },
          ],
        }
      : {},
    include: { profile: true },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    take: 100,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-text-muted">
          Manage staff roles and academy configuration.
        </p>
      </div>

      <Card>
        <h2 className="text-base font-semibold">Team &amp; roles</h2>
        <p className="mt-1 text-sm text-text-muted">
          Assign roles to control what each person can access. Changing a role signs the
          user out so the new permissions take effect on their next sign in.
        </p>
        <form className="mt-4" method="get">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search by name or email…"
            aria-label="Search users"
            className="w-full max-w-sm rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-text-muted focus:border-brand-1 focus:outline-2 focus:outline-brand-3"
          />
        </form>
        <RoleManager
          users={users.map((u) => ({
            id: u.id,
            email: u.email,
            fullName: u.profile?.fullName ?? null,
            role: u.role,
            status: u.status,
          }))}
          currentUserId={actor.id}
          actorIsFounder={actor.role === "FOUNDER"}
        />
      </Card>
    </div>
  );
}
