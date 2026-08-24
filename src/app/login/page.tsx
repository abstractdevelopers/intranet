import Link from "next/link";
import { AuthLayout } from "@/components/auth-layout";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your UCA Sandbox account.">
      <AuthForm
        endpoint="/api/auth/login"
        submitLabel="Sign in"
        fields={[
          { name: "email", label: "Email", type: "email", autoComplete: "email" },
          { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
        ]}
      />
      <div className="mt-4 flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-brand-1 hover:text-brand-2 dark:text-brand-3">
          Forgot password?
        </Link>
        <Link href="/signup" className="text-text-muted hover:text-text">
          Create an account
        </Link>
      </div>
    </AuthLayout>
  );
}
