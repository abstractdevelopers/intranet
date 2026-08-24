"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthLayout } from "@/components/auth-layout";
import { AuthForm } from "@/components/auth-form";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a secure reset link.">
      {sent ? (
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            If an account exists for that email, a password reset link is on its way.
          </p>
          <Link href="/login" className="text-sm font-medium text-brand-1 hover:text-brand-2 dark:text-brand-3">
            Back to sign in
          </Link>
        </div>
      ) : (
        <AuthForm
          endpoint="/api/auth/forgot-password"
          submitLabel="Send reset link"
          fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email" }]}
          onSuccess={() => setSent(true)}
        />
      )}
    </AuthLayout>
  );
}
