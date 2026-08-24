import { requireStaff } from "@/lib/rbac";
import { EmptyState } from "./empty";

export async function AdminSection({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  await requireStaff();
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <div className="mt-6">
        <EmptyState title={`${title} is coming next`} body={description} />
      </div>
    </div>
  );
}
