import { AuthLayoutShell } from "@/components/auth/auth-layout-shell";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

export default function ChangePasswordPage() {
  return (
    <AuthLayoutShell>
      <ChangePasswordForm forced />
    </AuthLayoutShell>
  );
}
