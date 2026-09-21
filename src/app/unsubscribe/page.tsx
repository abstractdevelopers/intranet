import { AuthLayout } from "@/components/auth-layout";
import { UnsubscribeForm } from "./unsubscribe-form";

export const metadata = { title: "Unsubscribe" };

/**
 * Public unsubscribe page. Read the token from the query string and pass it to
 * the client form, which posts it for verification.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <AuthLayout title="Email preferences" subtitle="Manage what lands in your inbox.">
      {token ? (
        <UnsubscribeForm token={token} />
      ) : (
        <p className="text-sm text-text-muted">
          This unsubscribe link is missing its token. Open the link directly from the email you
          received.
        </p>
      )}
    </AuthLayout>
  );
}