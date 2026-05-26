import { AuthLayoutShell } from "@/components/auth/auth-layout-shell";
import { InviteAcceptClient } from "@/components/auth/invite-accept-client";

type PageProps = { params: Promise<{ token: string }> };

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params;

  return (
    <AuthLayoutShell>
      <InviteAcceptClient token={token} />
    </AuthLayoutShell>
  );
}
