import { OutreachChannel, WebsiteStatus } from "@prisma/client";

export interface OutreachGenerationInput {
  businessName: string;
  websiteStatus: WebsiteStatus;
  category?: string | null;
  city?: string | null;
  state?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  websiteUrl?: string | null;
  auditSummary?: string | null;
  auditWeaknesses?: string[];
  channel?: OutreachChannel;
  senderName?: string;
  companyName?: string;
}

export interface OutreachGenerationResult {
  subject: string;
  message: string;
  smsMessage: string;
  facebookMessage: string;
  aiProvider: "openai" | "fallback";
  aiReasoning: string;
  aiScore: number;
  websiteAuditSummary: string;
}

const WEBSITE_HOOKS: Record<WebsiteStatus, string> = {
  NO_WEBSITE: "I noticed your business may not currently have a dedicated website",
  FACEBOOK_ONLY:
    "I noticed your business primarily uses Facebook for its online presence",
  BROKEN_WEBSITE:
    "I tried visiting your website and it appears to have issues loading",
  OUTDATED_WEBSITE:
    "I noticed your current website may be outdated or hard for customers to use on mobile",
  HAS_WEBSITE: "I was reviewing local businesses online and came across yours",
  UNKNOWN: "I was researching local businesses and wanted to reach out",
};

function fallbackDraft(params: OutreachGenerationInput): OutreachGenerationResult {
  const sender = params.senderName ?? "Isaac";
  const company = params.companyName ?? "Obsidian Systems LLC";
  const hook = WEBSITE_HOOKS[params.websiteStatus] ?? WEBSITE_HOOKS.UNKNOWN;
  const categoryLine = params.category
    ? `I work with local ${params.category} businesses on web presence and lead conversion.`
    : "I work with local businesses on web presence and lead conversion.";
  const auditSummary =
    params.auditSummary ??
    `${hook}. ${params.auditWeaknesses?.[0] ?? "There may be room to improve local trust and conversion online."}`;

  const message = `Hi ${params.businessName},

My name is ${sender} with ${company}. ${categoryLine}

${hook}, so I wanted to reach out and see if you'd be interested in a simple, mobile-friendly website or quick online presence audit.

The goal would be practical: make it easier for nearby customers to understand what you offer, trust the business, and contact you quickly.

If you're open to it, I can send over a few ideas. No pressure at all.

Best regards,
${sender}
${company}`;

  return {
    subject: `Quick question about ${params.businessName}'s online presence`,
    message,
    smsMessage: `Hi ${params.businessName}, this is ${sender} with ${company}. I noticed a few online presence opportunities and can send a quick website/audit idea if useful. Interested?`,
    facebookMessage: `Hi ${params.businessName}, I help local businesses improve websites and online presence. I noticed a few possible opportunities and would be happy to send a quick idea if that would be useful.`,
    aiProvider: "fallback",
    aiReasoning:
      "Generated from local template rules because OpenAI is disabled, unavailable, or not configured.",
    aiScore: params.websiteStatus === "NO_WEBSITE" ? 95 : params.websiteStatus === "HAS_WEBSITE" ? 45 : 80,
    websiteAuditSummary: auditSummary,
  };
}

function extractOutputText(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const outputText = (data as { output_text?: unknown }).output_text;
  if (typeof outputText === "string") return outputText;

  const output = (data as { output?: unknown }).output;
  if (!Array.isArray(output)) return null;

  const text: string[] = [];
  for (const item of output) {
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const value = (part as { text?: unknown }).text;
      if (typeof value === "string") text.push(value);
    }
  }
  return text.join("\n").trim() || null;
}

async function generateWithOpenAI(
  params: OutreachGenerationInput
): Promise<OutreachGenerationResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_OUTREACH_MODEL ?? "gpt-5-mini";
  const fallback = fallbackDraft(params);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        instructions:
          "You generate concise, ethical B2B outreach for Obsidian Systems LLC. Return only valid JSON.",
        input: JSON.stringify({
          task: "Create professional outreach drafts for manual approval before sending.",
          lead: params,
          requiredJsonShape: {
            subject: "string",
            email: "string",
            sms: "string under 320 chars",
            facebookDm: "string",
            reasoning: "string",
            score: "integer 0-100",
            websiteAuditSummary: "string",
          },
        }),
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const text = extractOutputText(data);
    if (!text) return null;

    const parsed = JSON.parse(text) as Partial<{
      subject: string;
      email: string;
      sms: string;
      facebookDm: string;
      reasoning: string;
      score: number;
      websiteAuditSummary: string;
    }>;

    if (!parsed.email) return null;

    return {
      subject: parsed.subject ?? fallback.subject,
      message: parsed.email,
      smsMessage: parsed.sms ?? fallback.smsMessage,
      facebookMessage: parsed.facebookDm ?? fallback.facebookMessage,
      aiProvider: "openai",
      aiReasoning: parsed.reasoning ?? "OpenAI generated the draft from lead and audit context.",
      aiScore: Number.isFinite(parsed.score) ? Number(parsed.score) : fallback.aiScore,
      websiteAuditSummary:
        parsed.websiteAuditSummary ?? fallback.websiteAuditSummary,
    };
  } catch (error) {
    console.error("[outreach openai fallback]", error);
    return null;
  }
}

export async function generateOutreachDraft(
  params: OutreachGenerationInput
): Promise<OutreachGenerationResult> {
  return (await generateWithOpenAI(params)) ?? fallbackDraft(params);
}

export function selectChannelMessage(
  result: OutreachGenerationResult,
  channel: OutreachChannel
): string {
  if (channel === "SMS") return result.smsMessage;
  if (channel === "FACEBOOK") return result.facebookMessage;
  return result.message;
}
