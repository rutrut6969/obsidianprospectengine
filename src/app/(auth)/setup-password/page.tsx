import { AuthLayoutShell } from "@/components/auth/auth-layout-shell";
import { SetupPasswordForm } from "@/components/auth/setup-password-form";

type PageProps = {
  searchParams: Promise<{ token?: string; reset?: string }>;
};

export default async function SetupPasswordPage({ searchParams }: PageProps) {
  const { token, reset } = await searchParams;
  const setupToken = token ?? reset;

  if (!setupToken) {
    return (
      <AuthLayoutShell>
        <p className="text-center text-red-300">Invalid setup link. Request a new invite.</p>
      </AuthLayoutShell>
    );
  }

  return (
    <AuthLayoutShell>
      <SetupPasswordForm token={setupToken} mode={reset ? "reset" : "invite"} />
    </AuthLayoutShell>
  );
}
