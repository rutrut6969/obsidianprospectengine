import { leadVisibilityWhere } from "@/lib/auth/access";
import { SessionPayload } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { createLeadActivity } from "@/lib/crm/activity";
import { getOperationalRecipientIds, notifyUsers } from "@/lib/notifications/service";

export async function convertLeadToClient(params: {
  leadId: string;
  session: SessionPayload;
  overrideDuplicate?: boolean;
}) {
  const lead = await prisma.businessLead.findFirst({
    where: { id: params.leadId, deletedAt: null, ...leadVisibilityWhere(params.session) },
    include: { clients: true },
  });

  if (!lead) throw new Error("Lead not found or unavailable.");
  if (lead.clients.length > 0 && !params.overrideDuplicate) {
    throw new Error("This lead is already linked to a client.");
  }

  const ownerId = lead.ownerId ?? params.session.userId;

  return prisma.$transaction(async (tx) => {
    const converted = await tx.client.create({
      data: {
        businessLeadId: lead.id,
        ownerId,
        closedById: params.session.userId,
        businessName: lead.name,
        businessCategory: lead.category,
        contactEmail: lead.primaryEmail,
        contactPhone: lead.phone,
        websiteUrl: lead.websiteUrl,
        city: lead.city,
        state: lead.state,
        status: "PROSPECT",
        paymentStatus: "UNPAID",
        retainerPaymentStatus: "CURRENT",
        notes: lead.notes,
      },
      include: {
        owner: { select: { id: true, fullName: true, email: true } },
        closedBy: { select: { id: true, fullName: true, email: true } },
        businessLead: { select: { id: true, name: true, category: true } },
      },
    });

    await tx.businessLead.update({
      where: { id: lead.id },
      data: { status: "CLIENT" },
    });

    await createLeadActivity({
      tx,
      businessLeadId: lead.id,
      userId: params.session.userId,
      type: "LEAD_CONVERTED",
      title: "Lead converted to client",
      body: `${lead.name} was converted into a client record.`,
      metadata: { clientId: converted.id },
    });

    const recipients = await getOperationalRecipientIds({
      tx,
      ownerId,
      closerId: params.session.userId,
    });

    await notifyUsers({
      tx,
      userIds: recipients,
      type: "CLIENT_CONVERTED",
      title: `Client converted: ${lead.name}`,
      body: "A lead was converted into a client and is ready for billing setup.",
      metadata: { leadId: lead.id, clientId: converted.id },
    });

    return converted;
  });
}
