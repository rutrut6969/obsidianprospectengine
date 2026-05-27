import { TemplatesDashboard } from "@/components/templates/templates-dashboard";

export default function TemplatesPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-purple-400">Admin</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-100">Email Templates</h1>
        <p className="mt-2 text-slate-400">
          Manage reusable Obsidian Systems email templates for outreach and campaigns.
        </p>
      </div>
      <TemplatesDashboard />
    </div>
  );
}
