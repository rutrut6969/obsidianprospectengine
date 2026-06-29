import { Resend } from "resend";
import { OutreachDraft } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveTemplate, renderTemplate } from "./email-template";
import { getOutboundFromAddress, resolveOutreachEmailRecipient } from "./email-config";

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

export async function sendApprovedEmailDraft(draftId: string) {
  const draft = await prisma.outreachDraft.findUnique({
    where: { id: draftId },
    include: { businessLead: { include: { contactMethods: true } } },
  });

  if (!draft) throw new Error("Draft not found");
  if (draft.channel !== "EMAIL") throw new Error("Draft is not an email draft");
  if (draft.status !== "APPROVED") {
    throw new Error("Only approved email drafts can be sent");
  }
  const recipient = resolveOutreachEmailRecipient(draft.businessLead);
  if (!recipient) {
    return markUnavailable(
      draft,
      "Lead does not have a primary email. Run email discovery or add a contact email before sending."
    );
  }

  const resend = getResendClient();
  if (!resend) {
    return markUnavailable(draft, "RESEND_API_KEY is not set. Email sending is unavailable.");
  }

  const template = await getActiveTemplate("COLD_OUTREACH");
  const variables = {
    businessName: draft.businessLead.name,
    businessCategory: draft.businessLead.category,
    city: draft.businessLead.city,
    senderName: "Isaac",
    websiteIssue: draft.websiteAuditSummary,
  };
  const subject = draft.subject ?? renderTemplate(template.subject, variables);
  const html = renderTemplate(template.html, variables).replace(
    "</div>\n",
    `<div style="white-space:pre-wrap;margin-top:20px;color:#cbd5e1;">${escapeHtml(draft.message)}</div></div>\n`
  );

  const { data, error } = await resend.emails.send({
    from: getOutboundFromAddress(),
    to: recipient.to,
    subject,
    html,
    text: draft.message,
  });

  if (error) {
    await prisma.outreachLog.create({
      data: {
        outreachDraftId: draft.id,
        businessLeadId: draft.businessLeadId,
        channel: "EMAIL",
        provider: "resend",
        deliveryStatus: "FAILED",
        error: error.message,
      },
    });
    await prisma.outreachDraft.update({
      where: { id: draft.id },
      data: { status: "FAILED", failureReason: error.message },
    });
    throw new Error(error.message);
  }

  const sentAt = new Date();
  const log = await prisma.outreachLog.create({
    data: {
      outreachDraftId: draft.id,
      businessLeadId: draft.businessLeadId,
      channel: "EMAIL",
      provider: "resend",
      deliveryStatus: "SENT",
      providerMessageId: data?.id ?? null,
      error: recipient.warning,
      sentAt,
    },
  });

  await prisma.outreachDraft.update({
    where: { id: draft.id },
    data: { status: "SENT", sentAt, failureReason: null },
  });
  await prisma.leadActivity.create({
    data: {
      businessLeadId: draft.businessLeadId,
      type: "OUTREACH_SENT",
      title: "Email draft sent",
      body: [
        `To: ${recipient.isTestOverride ? "test override" : recipient.to}`,
        data?.id ? `Resend message id: ${data.id}` : null,
        recipient.warning,
      ].filter(Boolean).join(" | "),
    },
  });

  return { log, sent: true };
}

async function markUnavailable(draft: OutreachDraft, reason: string) {
  const log = await prisma.outreachLog.create({
    data: {
      outreachDraftId: draft.id,
      businessLeadId: draft.businessLeadId,
      channel: "EMAIL",
      provider: "resend",
      deliveryStatus: "UNAVAILABLE",
      error: reason,
    },
  });

  return { log, sent: false, unavailable: true, reason };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
