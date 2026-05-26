import { ApprovalQueue } from "@/components/outreach/approval-queue";

export default function OutreachApprovalPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-purple-400">Admin</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-100">
          Outreach Approval Queue
        </h1>
        <p className="mt-2 text-slate-400">
          Review, edit, approve, reject, and send manually approved outreach drafts.
        </p>
      </div>
      <ApprovalQueue />
    </div>
  );
}
