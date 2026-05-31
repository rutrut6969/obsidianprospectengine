import { Prisma, LeadStatus, WebsiteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SessionPayload } from "@/lib/auth/session";
import { defaultLeadOwnership, isSessionSuperAdmin, leadVisibilityWhere } from "@/lib/auth/access";
import {
  buildDuplicateFingerprint,
  normalizePhone,
  normalizeText,
  normalizeWebsite,
} from "./normalization";

export interface LeadInput {
  placeId?: string | null;
  name: string;
  category?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  websiteUrl?: string | null;
  googleMapsUrl?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  websiteStatus?: WebsiteStatus | string | null;
  leadScore?: number | null;
  notes?: string | null;
  status?: LeadStatus | string | null;
}

export function buildLeadData(
  input: LeadInput,
  session?: SessionPayload
): Prisma.BusinessLeadUncheckedCreateInput {
  const name = input.name.trim();
  const normalizedName = normalizeText(name);
  const normalizedAddress = normalizeText(input.address);
  const normalizedPhone = normalizePhone(input.phone);
  const normalizedWebsite = normalizeWebsite(input.websiteUrl);
  const duplicateKey = buildDuplicateFingerprint({
    name,
    address: input.address,
    city: input.city,
    state: input.state,
  });

  return {
    name,
    category: input.category?.trim() || null,
    address: input.address?.trim() || null,
    city: input.city?.trim() || null,
    state: input.state?.trim()?.toUpperCase() || null,
    phone: input.phone?.trim() || null,
    websiteUrl: input.websiteUrl?.trim() || null,
    googleMapsUrl: input.googleMapsUrl?.trim() || null,
    rating: input.rating != null ? Number(input.rating) : null,
    reviewCount: input.reviewCount != null ? Number(input.reviewCount) : null,
    websiteStatus: (input.websiteStatus as WebsiteStatus) ?? "UNKNOWN",
    leadScore: input.leadScore != null ? Number(input.leadScore) : 0,
    notes: input.notes ?? null,
    status: (input.status as LeadStatus) ?? "SAVED",
    placeId: input.placeId?.trim() || null,
    ...(session ? defaultLeadOwnership(session) : {}),
    normalizedName,
    normalizedAddress,
    normalizedPhone,
    normalizedWebsite,
    duplicateKey,
    deletedAt: null,
    isArchived: false,
  };
}

function duplicateConditions(
  data: Prisma.BusinessLeadUncheckedCreateInput
): Prisma.BusinessLeadWhereInput[] {
  const conditions: Prisma.BusinessLeadWhereInput[] = [];
  if (data.placeId) conditions.push({ placeId: data.placeId });
  if (data.normalizedPhone) conditions.push({ normalizedPhone: data.normalizedPhone });
  if (data.normalizedWebsite) conditions.push({ normalizedWebsite: data.normalizedWebsite });
  if (data.duplicateKey) conditions.push({ duplicateKey: data.duplicateKey });
  return conditions;
}

function privateCopyConditionsFromLead(
  lead: {
    normalizedPhone?: string | null;
    normalizedWebsite?: string | null;
    duplicateKey?: string | null;
  },
  ownerId: string
): Prisma.BusinessLeadWhereInput[] {
  const conditions: Prisma.BusinessLeadWhereInput[] = [];
  if (lead.normalizedPhone) conditions.push({ ownerId, normalizedPhone: lead.normalizedPhone });
  if (lead.normalizedWebsite) conditions.push({ ownerId, normalizedWebsite: lead.normalizedWebsite });
  if (lead.duplicateKey) conditions.push({ ownerId, duplicateKey: lead.duplicateKey });
  return conditions;
}

function copyLeadData(
  duplicate: Awaited<ReturnType<typeof findDuplicateLead>>,
  data: Prisma.BusinessLeadUncheckedCreateInput,
  session: SessionPayload,
  input: LeadInput
): Prisma.BusinessLeadUncheckedCreateInput {
  if (!duplicate) return { ...data, placeId: null };

  return {
    ...data,
    name: data.name || duplicate.name,
    category: data.category ?? duplicate.category,
    address: data.address ?? duplicate.address,
    city: data.city ?? duplicate.city,
    state: data.state ?? duplicate.state,
    phone: data.phone ?? duplicate.phone,
    websiteUrl: data.websiteUrl ?? duplicate.websiteUrl,
    googleMapsUrl: data.googleMapsUrl ?? duplicate.googleMapsUrl,
    rating: data.rating ?? duplicate.rating,
    reviewCount: data.reviewCount ?? duplicate.reviewCount,
    websiteStatus: data.websiteStatus ?? duplicate.websiteStatus,
    leadScore: data.leadScore ?? duplicate.leadScore,
    notes: input.notes ?? duplicate.notes,
    status: (input.status as LeadStatus) ?? "SAVED",
    placeId: null,
    ownerId: session.userId,
    visibility: "PRIVATE",
    primaryEmail: duplicate.primaryEmail,
    emailDiscoveryStatus: duplicate.emailDiscoveryStatus,
    emailConfidence: duplicate.emailConfidence,
    normalizedName: data.normalizedName ?? duplicate.normalizedName,
    normalizedAddress: data.normalizedAddress ?? duplicate.normalizedAddress,
    normalizedPhone: data.normalizedPhone ?? duplicate.normalizedPhone,
    normalizedWebsite: data.normalizedWebsite ?? duplicate.normalizedWebsite,
    duplicateKey: data.duplicateKey ?? duplicate.duplicateKey,
    tags: duplicate.tags,
    deletedAt: null,
    isArchived: false,
  };
}

export async function findDuplicateLead(input: LeadInput) {
  const data = buildLeadData(input);
  const OR = duplicateConditions(data);
  if (OR.length === 0) return null;

  return prisma.businessLead.findFirst({
    where: { OR },
    orderBy: { updatedAt: "desc" },
  });
}

export async function saveLeadWithDuplicateProtection(
  input: LeadInput,
  session?: SessionPayload
) {
  const data = buildLeadData(input, session);
  const OR = duplicateConditions(data);
  const ownedDuplicate =
    session && OR.length > 0
      ? await prisma.businessLead.findFirst({
          where: {
            OR,
            ownerId: session.userId,
          },
          orderBy: { updatedAt: "desc" },
        })
      : null;

  if (ownedDuplicate) {
    const lead = await prisma.businessLead.update({
      where: { id: ownedDuplicate.id },
      data: {
        ...data,
        placeId: ownedDuplicate.placeId,
        ownerId: ownedDuplicate.ownerId,
        visibility: ownedDuplicate.visibility,
        status: (input.status as LeadStatus) ?? ownedDuplicate.status,
        deletedAt: null,
        isArchived: false,
      },
    });
    return { lead, duplicate: true, created: false, owned: true };
  }

  const duplicate =
    OR.length === 0
      ? null
      : await prisma.businessLead.findFirst({
          where: {
            OR,
            ...(session ? leadVisibilityWhere(session) : {}),
          },
          orderBy: { updatedAt: "desc" },
        });

  if (duplicate) {
    if (session && !isSessionSuperAdmin(session) && duplicate.ownerId !== session.userId) {
      const privateCopyOR = privateCopyConditionsFromLead(duplicate, session.userId);
      const existingPrivateCopy =
        privateCopyOR.length > 0
          ? await prisma.businessLead.findFirst({
              where: { OR: privateCopyOR, deletedAt: null },
              orderBy: { updatedAt: "desc" },
            })
          : null;

      if (existingPrivateCopy) {
        const lead = await prisma.businessLead.update({
          where: { id: existingPrivateCopy.id },
          data: {
            status: (input.status as LeadStatus) ?? existingPrivateCopy.status,
            notes: input.notes ?? existingPrivateCopy.notes,
            deletedAt: null,
            isArchived: false,
          },
        });
        return { lead, duplicate: true, created: false, privateCopy: true };
      }

      const lead = await prisma.businessLead.create({
        data: copyLeadData(duplicate, data, session, input),
      });
      await prisma.leadActivity.create({
        data: {
          businessLeadId: lead.id,
          userId: session.userId,
          type: "LEAD_UPDATED",
          title: "Private lead saved",
          body: "Private copy created from a shared global lead.",
          metadata: { sourceLeadId: duplicate.id },
        },
      });
      return { lead, duplicate: true, created: true, privateCopy: true };
    }

    const lead = await prisma.businessLead.update({
      where: { id: duplicate.id },
      data: {
        ...data,
        status: (input.status as LeadStatus) ?? duplicate.status,
        deletedAt: null,
        isArchived: false,
      },
    });
    return { lead, duplicate: true, created: false };
  }

  const lead = await prisma.businessLead.create({ data });
  await prisma.leadActivity.create({
      data: {
        businessLeadId: lead.id,
        userId: session?.userId,
        type: "LEAD_UPDATED",
      title: "Lead saved",
      body: "Lead was added to the CRM.",
    },
  });

  return { lead, duplicate: false, created: true };
}

export async function softDeleteLead(id: string, session?: SessionPayload) {
  return prisma.$transaction(async (tx) => {
    const lead = await tx.businessLead.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isArchived: true,
        status: "ARCHIVED",
      },
    });

    await tx.leadActivity.create({
      data: {
        businessLeadId: id,
        userId: session?.userId,
        type: "LEAD_DELETED",
        title: "Lead deleted",
        body: "Lead was soft-deleted and can be restored later.",
      },
    });

    return lead;
  });
}

export async function restoreLead(id: string, session?: SessionPayload) {
  return prisma.$transaction(async (tx) => {
    const lead = await tx.businessLead.update({
      where: { id },
      data: {
        deletedAt: null,
        isArchived: false,
        status: "SAVED",
      },
    });

    await tx.leadActivity.create({
      data: {
        businessLeadId: id,
        userId: session?.userId,
        type: "LEAD_RESTORED",
        title: "Lead restored",
      },
    });

    return lead;
  });
}
