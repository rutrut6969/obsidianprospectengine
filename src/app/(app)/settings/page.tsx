import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Key,
  Database,
  Sparkles,
  Mail,
  MessageSquare,
  CreditCard,
  Webhook,
  Lock,
} from "lucide-react";
import { ProfileSettings } from "@/components/settings/profile-settings";

const integrations = [
  {
    name: "Database and Auth",
    status: "Required",
    icon: Database,
    summary: "Prisma PostgreSQL storage, JWT sessions, seedable super admin.",
    env: ["DATABASE_URL", "SESSION_SECRET", "APP_URL", "NEXT_PUBLIC_APP_URL"],
  },
  {
    name: "Google Places",
    status: "Required for lead search",
    icon: Key,
    summary: "Lead search uses Places Text Search and Geocoding. Website audit still works without it.",
    env: ["GOOGLE_PLACES_API_KEY"],
  },
  {
    name: "OpenAI",
    status: "Optional",
    icon: Sparkles,
    summary: "Outreach and pricing use OpenAI when configured; otherwise local fallback logic is used.",
    env: ["OPENAI_API_KEY", "OPENAI_OUTREACH_MODEL", "OPENAI_PRICING_MODEL"],
  },
  {
    name: "Email",
    status: "Required for outbound email",
    icon: Mail,
    summary:
      "Resend sends invites and approved email outreach. Outreach targets the lead primary email by default.",
    env: [
      "RESEND_API_KEY",
      "RESEND_FROM_EMAIL",
      "RESEND_OUTREACH_FROM_EMAIL",
      "OUTREACH_TEST_TO_EMAIL",
      "OUTREACH_ALLOW_TEST_OVERRIDE",
    ],
  },
  {
    name: "Twilio SMS",
    status: "Optional",
    icon: MessageSquare,
    summary: "Approved SMS drafts send through Twilio when all three Twilio variables are configured.",
    env: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"],
  },
  {
    name: "Square Billing",
    status: "Optional until billing send",
    icon: CreditCard,
    summary:
      "Local clients/invoices work without Square. Hosted invoices and subscriptions require Square credentials.",
    env: [
      "SQUARE_ACCESS_TOKEN",
      "SQUARE_LOCATION_ID",
      "SQUARE_ENVIRONMENT",
      "SQUARE_PROMO_RETAINER_PLAN_VARIATION_ID",
      "SQUARE_STANDARD_RETAINER_PLAN_VARIATION_ID",
    ],
  },
  {
    name: "Square Webhooks",
    status: "Required for payment sync",
    icon: Webhook,
    summary:
      "Webhook signature verification and payment/commission sync require the exact webhook URL and signature key.",
    env: ["SQUARE_WEBHOOK_SIGNATURE_KEY", "SQUARE_WEBHOOK_URL"],
  },
  {
    name: "Payout Security",
    status: "Recommended",
    icon: Lock,
    summary: "Direct deposit details are masked; routing/account values are encrypted when this key is set.",
    env: ["PAYOUT_ENCRYPTION_KEY"],
  },
];

export default function SettingsPage() {
  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <p className="text-sm font-medium text-purple-400">Configuration</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-100">Settings</h1>
        <p className="mt-2 text-slate-400">
          Operational environment and integration wiring for Obsidian Prospect Engine.
        </p>
      </div>

      <ProfileSettings />

      <Card>
        <CardHeader
          title="Integration Status Map"
          description="Configure secrets in Vercel project settings; keep test overrides out of normal production sends"
        />
        <CardBody className="grid gap-4 lg:grid-cols-2">
          {integrations.map(({ name, status, summary, env, icon: Icon }) => (
            <div
              key={name}
              className="rounded-lg border border-slate-800 bg-slate-950/50 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-purple-500/20 bg-purple-500/10">
                  <Icon className="h-5 w-5 text-purple-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-slate-100">{name}</h2>
                    <Badge variant={status.includes("Required") ? "amber" : "slate"}>{status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{summary}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {env.map((key) => (
                      <code
                        key={key}
                        className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-emerald-300"
                      >
                        {key}
                      </code>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Outbound Email Safety" />
        <CardBody className="space-y-3 text-sm text-slate-400">
          <p>
            Approved email outreach sends to the lead primary email, or the best discovered email contact if
            no primary email is stored.
          </p>
          <p>
            `OUTREACH_TEST_TO_EMAIL` is a safety override for QA. In production it is ignored unless
            `OUTREACH_ALLOW_TEST_OVERRIDE=true` is also set, so production cannot accidentally remain in
            test-recipient-only mode.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="First-time admin setup" />
        <CardBody className="space-y-2 text-sm text-slate-400">
          <p>
            After configuring a real PostgreSQL `DATABASE_URL`, run Prisma schema setup and seed the
            super admin:
          </p>
          <div className="space-y-1 font-mono text-purple-300">
            <p>npm run db:push</p>
            <p>npm run db:seed</p>
          </div>
          <p className="text-slate-500">
            Super admin email: isaac.rutledgev@obsidian-systems.tech
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Unsupported Delivery Channels" />
        <CardBody className="text-sm text-slate-400">
          Facebook DM content can be drafted manually, but automated Facebook sending is not wired. The UI
          exposes email and SMS delivery only.
        </CardBody>
      </Card>
    </div>
  );
}
