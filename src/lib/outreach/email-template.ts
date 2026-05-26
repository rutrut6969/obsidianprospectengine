import { TemplateType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const DEFAULT_SUBJECT = "Quick question about {{businessName}}";

const DEFAULT_TEXT = `Hi {{businessName}},

I noticed a possible opportunity with your online presence around {{websiteIssue}}.

Obsidian Systems helps local {{businessCategory}} businesses build clean, mobile-friendly websites that make it easier for customers in {{city}} to call, book, or request a quote.

Would it be useful if {{senderName}} sent a quick website audit idea?

Best,
{{senderName}}
Obsidian Systems LLC`;

const DEFAULT_HTML = `
  <div style="margin:0;background:#0a0a0f;color:#e2e8f0;font-family:Inter,Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
      <div style="border:1px solid #1e293b;background:#111827;border-radius:12px;overflow:hidden;">
        <div style="padding:24px;border-bottom:1px solid #1e293b;">
          <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#a855f7;font-weight:700;">Obsidian Systems</div>
          <h1 style="font-size:22px;line-height:1.25;margin:8px 0 0;color:#f8fafc;">A practical web presence idea for {{businessName}}</h1>
        </div>
        <div style="padding:24px;color:#cbd5e1;line-height:1.7;font-size:15px;">
          <p>Hi {{businessName}},</p>
          <p>I noticed a possible opportunity with your online presence around <strong style="color:#86efac;">{{websiteIssue}}</strong>.</p>
          <p>Obsidian Systems helps local {{businessCategory}} businesses build clean, mobile-friendly websites that make it easier for customers in {{city}} to call, book, or request a quote.</p>
          <p style="margin:28px 0;">
            <a href="{{ctaLink}}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:8px;">Request a quick audit</a>
          </p>
          <p>Best,<br />{{senderName}}<br />Obsidian Systems LLC</p>
        </div>
        <div style="padding:18px 24px;border-top:1px solid #1e293b;color:#64748b;font-size:12px;line-height:1.6;">
          Obsidian Systems LLC · sales@obsidian-systems.tech<br />
          You are receiving this because your business information is publicly listed. Reply “unsubscribe” to opt out.
        </div>
      </div>
    </div>
  </div>
`;

export interface TemplateVariables {
  businessName: string;
  senderName?: string;
  websiteIssue?: string | null;
  ctaLink?: string;
  businessCategory?: string | null;
  city?: string | null;
}

export function renderTemplate(template: string, variables: TemplateVariables): string {
  const values: Record<string, string> = {
    businessName: variables.businessName,
    senderName: variables.senderName ?? "Isaac",
    websiteIssue: variables.websiteIssue ?? "website usability and local conversion",
    ctaLink: variables.ctaLink ?? "https://prospect.obsidian-systems.tech",
    businessCategory: variables.businessCategory ?? "local",
    city: variables.city ?? "your area",
  };

  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => values[key] ?? "");
}

export async function getActiveTemplate(type: TemplateType = "COLD_OUTREACH") {
  const existing = await prisma.emailTemplate.findFirst({
    where: { type, isActive: true },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) return existing;

  return prisma.emailTemplate.create({
    data: {
      name: "Default Cold Outreach",
      type,
      subject: DEFAULT_SUBJECT,
      html: DEFAULT_HTML,
      text: DEFAULT_TEXT,
      isActive: true,
    },
  });
}
