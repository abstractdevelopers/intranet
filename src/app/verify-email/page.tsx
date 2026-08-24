"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/auth-layout";
import { ButtonLink } from "@/components/ui/button";

function Verify() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState<"idle" | "verifying" | "ok" | "error">(token ? "verifying" : "idle");

  useEffect(() => {
    if (!token) return;
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => setState(res.ok ? "ok" : "error"))
      .catch(() => setState("error"));
  }, [token]);

  if (state === "ok") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-text-muted">Your email has been verified. You can now continue to your application.</p>
        <ButtonLink href="/student" className="w-full">Continue</ButtonLink>
      </div>
    );
  }
  if (state === "error") {
    return <p className="text-sm text-text-muted">This verification link is invalid or has expired.</p>;
  }
  if (state === "verifying") {
    return <p className="text-sm text-text-muted">Verifying your email…</p>;
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">
        We sent a verification link to your email address. Open it to verify your account,
        then continue to your application.
      </p>
      <p className="text-sm text-text-muted">
        Already verified?{" "}
        <Link href="/student" className="font-medium text-brand-1 hover:text-brand-2 dark:text-brand-3">
          Continue to your portal
        </Link>
      </p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthLayout title="Verify your email" subtitle="One quick step before you apply.">
      <Suspense>
        <Verify />
      </Suspense>
    </AuthLayout>
  );
}
