import { NextRequest, NextResponse } from "next/server";
import { LeadStatus, WebsiteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      placeId,
      name,
      category,
      address,
      city,
      state,
      phone,
      websiteUrl,
      googleMapsUrl,
      rating,
      reviewCount,
      websiteStatus,
      leadScore,
      notes,
      status,
      audit,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const leadData = {
      name: name.trim(),
      category: category ?? null,
      address: address ?? null,
      city: city ?? null,
      state: state ?? null,
      phone: phone ?? null,
      websiteUrl: websiteUrl ?? null,
      googleMapsUrl: googleMapsUrl ?? null,
      rating: rating != null ? Number(rating) : null,
      reviewCount: reviewCount != null ? Number(reviewCount) : null,
      websiteStatus: (websiteStatus as WebsiteStatus) ?? "UNKNOWN",
      leadScore: leadScore != null ? Number(leadScore) : 0,
      notes: notes ?? null,
      status: (status as LeadStatus) ?? "SAVED",
      placeId: placeId ?? null,
    };

    const lead = placeId
      ? await prisma.businessLead.upsert({
          where: { placeId },
          create: leadData,
          update: { ...leadData, status: leadData.status },
        })
      : await prisma.businessLead.create({ data: leadData });

    if (audit) {
      await prisma.websiteAudit.create({
        data: {
          businessLeadId: lead.id,
          hasWebsite: Boolean(audit.hasWebsite),
          isBroken: Boolean(audit.isBroken),
          isHttps: audit.isHttps ?? null,
          isFacebookOnly: Boolean(audit.isFacebookOnly),
          homepageTitle: audit.homepageTitle ?? null,
          metaDescription: audit.metaDescription ?? null,
          responseStatus: audit.responseStatus ?? null,
          loadTimeMs: audit.loadTimeMs ?? null,
          notes: audit.notes ?? null,
        },
      });
    }

    return NextResponse.json({ lead });
  } catch (error) {
    console.error("[save-lead]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Save failed" },
      { status: 500 }
    );
  }
}
