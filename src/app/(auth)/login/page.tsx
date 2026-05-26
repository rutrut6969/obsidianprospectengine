import { Suspense } from "react";
import { AuthLayoutShell } from "@/components/auth/auth-layout-shell";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <AuthLayoutShell>
      <Suspense fallback={<p className="text-slate-500 text-center">Loading…</p>}>
        <LoginForm />
      </Suspense>
    </AuthLayoutShell>
  );
}
