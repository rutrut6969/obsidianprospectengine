import { AuthLayoutShell } from "@/components/auth/auth-layout-shell";
import { SetupPasswordForm } from "@/components/auth/setup-password-form";

type PageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function SetupPasswordPage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <AuthLayoutShell>
        <p className="text-center text-red-300">Invalid setup link. Request a new invite.</p>
      </AuthLayoutShell>
    );
  }

  return (
    <AuthLayoutShell>
      <SetupPasswordForm token={token} />
    </AuthLayoutShell>
  );
}
