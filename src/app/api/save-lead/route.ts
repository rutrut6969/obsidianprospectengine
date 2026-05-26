import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveLeadWithDuplicateProtection } from "@/lib/leads/service";

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

    const { lead, duplicate, created } = await saveLeadWithDuplicateProtection({
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
    });

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
          mobileFriendly: audit.mobileFriendly ?? null,
          brokenLinks: audit.brokenLinks ?? null,
          pageSpeedScore: audit.pageSpeedScore ?? null,
          accessibilityNotes: audit.accessibilityNotes ?? null,
          seoNotes: audit.seoNotes ?? null,
          responsivenessNotes: audit.responsivenessNotes ?? null,
          ctaQuality: audit.ctaQuality ?? null,
          professionalismScore: audit.professionalismScore ?? null,
          summary: audit.summary ?? null,
          weaknesses: audit.weaknesses ?? [],
          improvements: audit.improvements ?? [],
          leadQualityScore: audit.leadQualityScore ?? null,
          conversionOpportunityScore: audit.conversionOpportunityScore ?? null,
        },
      });
    }

    return NextResponse.json({ lead, duplicate, created });
  } catch (error) {
    console.error("[save-lead]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Save failed" },
      { status: 500 }
    );
  }
}
