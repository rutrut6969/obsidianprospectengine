import { prisma } from "@/lib/prisma";

function twilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  return { accountSid, authToken, fromNumber, available: Boolean(accountSid && authToken && fromNumber) };
}

export function getTwilioAvailability() {
  const config = twilioConfig();
  return {
    available: config.available,
    reason: config.available
      ? null
      : "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER are required for SMS sending.",
  };
}

export async function sendApprovedSmsDraft(draftId: string) {
  const draft = await prisma.outreachDraft.findUnique({
    where: { id: draftId },
    include: { businessLead: true },
  });
  if (!draft) throw new Error("Draft not found");
  if (draft.channel !== "SMS") throw new Error("Draft is not an SMS draft");
  if (draft.status !== "APPROVED") throw new Error("Only approved SMS drafts can be sent");

  const config = twilioConfig();
  if (!config.available) {
    return prisma.outreachLog.create({
      data: {
        outreachDraftId: draft.id,
        businessLeadId: draft.businessLeadId,
        channel: "SMS",
        provider: "twilio",
        deliveryStatus: "UNAVAILABLE",
        error: getTwilioAvailability().reason,
      },
    });
  }

  if (!draft.businessLead.phone) {
    throw new Error("Lead does not have a phone number");
  }

  const recent = await prisma.outreachLog.findFirst({
    where: {
      businessLeadId: draft.businessLeadId,
      channel: "SMS",
      sentAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24) },
    },
  });
  if (recent) {
    throw new Error("SMS cooldown active for this lead");
  }

  const body = new URLSearchParams({
    To: draft.businessLead.phone,
    From: config.fromNumber!,
    Body: draft.message.slice(0, 1500),
  });
  const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    }
  );
  const data = (await response.json()) as { sid?: string; message?: string };

  if (!response.ok) {
    await prisma.outreachDraft.update({
      where: { id: draft.id },
      data: { status: "FAILED", failureReason: data.message ?? "Twilio send failed" },
    });
    throw new Error(data.message ?? "Twilio send failed");
  }

  const sentAt = new Date();
  const log = await prisma.outreachLog.create({
    data: {
      outreachDraftId: draft.id,
      businessLeadId: draft.businessLeadId,
      channel: "SMS",
      provider: "twilio",
      deliveryStatus: "SENT",
      providerMessageId: data.sid ?? null,
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
      title: "SMS draft sent",
      body: data.sid ? `Twilio SID: ${data.sid}` : null,
    },
  });

  return log;
}
