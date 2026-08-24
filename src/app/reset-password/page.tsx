"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/auth-layout";
import { AuthForm } from "@/components/auth-form";

function ResetForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [done, setDone] = useState(false);

  if (!token) {
    return <p className="text-sm text-text-muted">This reset link is invalid.</p>;
  }
  if (done) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-text-muted">Your password has been updated.</p>
        <Link href="/login" className="text-sm font-medium text-brand-1 hover:text-brand-2 dark:text-brand-3">
          Sign in
        </Link>
      </div>
    );
  }
  return (
    <AuthForm
      endpoint="/api/auth/reset-password"
      submitLabel="Update password"
      fields={[
        { name: "token", label: "", type: "hidden" },
        { name: "password", label: "New password", type: "password", autoComplete: "new-password", placeholder: "At least 8 characters" },
      ]}
      onSuccess={() => setDone(true)}
    />
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthLayout title="Choose a new password" subtitle="Set a new password for your account.">
      <Suspense>
        <ResetForm />
      </Suspense>
    </AuthLayout>
  );
}
