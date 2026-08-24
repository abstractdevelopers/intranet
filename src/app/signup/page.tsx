import Link from "next/link";
import { AuthLayout } from "@/components/auth-layout";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start your application to the academy."
    >
      <AuthForm
        endpoint="/api/auth/signup"
        submitLabel="Create account"
        fields={[
          { name: "fullName", label: "Full name", type: "text", autoComplete: "name" },
          { name: "email", label: "Email", type: "email", autoComplete: "email" },
          { name: "password", label: "Password", type: "password", autoComplete: "new-password", placeholder: "At least 8 characters" },
        ]}
      />
      <p className="mt-4 text-sm text-text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-brand-1 hover:text-brand-2 dark:text-brand-3">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
