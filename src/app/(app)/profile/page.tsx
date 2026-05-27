import { ProfileSettings } from "@/components/settings/profile-settings";

export default function ProfilePage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-purple-400">Account</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-100">Profile Settings</h1>
        <p className="mt-2 text-slate-400">
          Manage your profile, payout preferences, password, and activity summary.
        </p>
      </div>
      <ProfileSettings expanded />
    </div>
  );
}
