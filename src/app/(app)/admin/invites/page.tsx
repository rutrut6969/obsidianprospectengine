import { AdminInvitesPanel } from "@/components/admin/admin-invites-panel";

export const dynamic = "force-dynamic";

export default function AdminInvitesPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-purple-400">Admin</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-100">Team Access</h1>
        <p className="mt-2 text-slate-400">
          Invite authorized users by email. Invites are sent via Resend.
        </p>
      </div>
      <AdminInvitesPanel />
    </div>
  );
}
