import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Key, Database, Sparkles, Mail, MessageSquare } from "lucide-react";

const envVars = [
  {
    key: "DATABASE_URL",
    required: true,
    description: "PostgreSQL connection string for Prisma",
    icon: Database,
  },
  {
    key: "GOOGLE_PLACES_API_KEY",
    required: true,
    description:
      "Google Cloud API key with Places API (New) and Geocoding API enabled",
    icon: Key,
  },
  {
    key: "OPENAI_API_KEY",
    required: false,
    description: "Optional — for AI-powered outreach drafts (not yet wired)",
    icon: Sparkles,
  },
  {
    key: "RESEND_API_KEY",
    required: false,
    description: "Optional — for sending email outreach later",
    icon: Mail,
  },
  {
    key: "TWILIO_ACCOUNT_SID",
    required: false,
    description: "Optional — for SMS outreach later",
    icon: MessageSquare,
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <p className="text-sm font-medium text-purple-400">Configuration</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-100">Settings</h1>
        <p className="mt-2 text-slate-400">
          Environment variables and API setup for Obsidian Prospect Engine.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Environment Variables"
          description="Copy .env.example to .env and fill in your values"
        />
        <CardBody className="space-y-4">
          {envVars.map(({ key, required, description, icon: Icon }) => (
            <div
              key={key}
              className="flex gap-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 border border-purple-500/20">
                <Icon className="h-5 w-5 text-purple-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="text-sm text-emerald-400 font-mono">{key}</code>
                  <Badge variant={required ? "amber" : "slate"}>
                    {required ? "Required" : "Optional"}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-slate-400">{description}</p>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Google Places API Setup" />
        <CardBody className="text-sm text-slate-400 space-y-3">
          <p>
            Enable <strong className="text-slate-300">Places API (New)</strong> and{" "}
            <strong className="text-slate-300">Geocoding API</strong> in Google Cloud
            Console. This app uses official REST endpoints only — no HTML scraping.
          </p>
          <ol className="list-decimal list-inside space-y-2 text-slate-500">
            <li>Create a project in Google Cloud Console</li>
            <li>Enable billing (Places has usage-based pricing)</li>
            <li>Create an API key and restrict it to Places + Geocoding</li>
            <li>Add the key to <code className="text-purple-300">GOOGLE_PLACES_API_KEY</code></li>
          </ol>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Database Setup" />
        <CardBody className="text-sm text-slate-400 space-y-2 font-mono">
          <p className="font-sans text-slate-400 mb-3">
            After setting DATABASE_URL, run:
          </p>
          <p className="text-purple-300">npm run db:push</p>
          <p className="text-purple-300">npm run dev</p>
        </CardBody>
      </Card>
    </div>
  );
}
