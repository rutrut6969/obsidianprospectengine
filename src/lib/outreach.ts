import { WebsiteStatus } from "@prisma/client";

/**
 * Placeholder outreach generator (no OpenAI yet).
 * Set OPENAI_API_KEY later and swap this for an AI-powered draft.
 */
export function generateOutreachDraft(params: {
  businessName: string;
  websiteStatus: WebsiteStatus;
  senderName?: string;
  companyName?: string;
}): { subject: string; message: string } {
  const sender = params.senderName ?? "Isaac";
  const company = params.companyName ?? "Obsidian Systems LLC";
  const name = params.businessName;

  const hooks: Record<WebsiteStatus, string> = {
    NO_WEBSITE:
      "I noticed your business may not currently have a dedicated website",
    FACEBOOK_ONLY:
      "I noticed your business primarily uses Facebook for its online presence",
    BROKEN_WEBSITE:
      "I tried visiting your website and it appears to have issues loading",
    OUTDATED_WEBSITE:
      "I noticed your current website may be outdated or hard for customers to use on mobile",
    HAS_WEBSITE:
      "I was reviewing local businesses online and came across yours",
    UNKNOWN:
      "I was researching local businesses and wanted to reach out",
  };

  const hook = hooks[params.websiteStatus] ?? hooks.UNKNOWN;

  const message = `Hi ${name},

My name is ${sender} with ${company}. I help local businesses build clean, mobile-friendly websites that make it easier for customers to find services, view products, and contact you online.

${hook}, so I wanted to reach out and see if you'd be interested in a simple, affordable website build.

If you're open to a quick conversation, I'd be happy to share examples and answer any questions — no pressure at all.

Best regards,
${sender}
${company}`;

  const subject = `Quick question about ${name}'s online presence`;

  return { subject, message };
}
