import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditWebsite } from "@/lib/website-audit";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { websiteUrl, businessLeadId } = body as {
      websiteUrl?: string;
      businessLeadId?: string;
    };

    const result = await auditWebsite(websiteUrl);

    let savedAudit = null;
    if (businessLeadId) {
      savedAudit = await prisma.$transaction(async (tx) => {
        const audit = await tx.websiteAudit.create({
          data: {
            businessLeadId,
            hasWebsite: result.signals.hasWebsite,
            isBroken: result.signals.isBroken,
            isHttps: result.signals.isHttps,
            isFacebookOnly: result.signals.isFacebookOnly,
            homepageTitle: result.homepageTitle,
            metaDescription: result.metaDescription,
            responseStatus: result.responseStatus,
            loadTimeMs: result.loadTimeMs,
            notes: result.notes,
            mobileFriendly: result.mobileFriendly,
            brokenLinks: result.brokenLinks,
            pageSpeedScore: result.pageSpeedScore,
            accessibilityNotes: result.accessibilityNotes,
            seoNotes: result.seoNotes,
            responsivenessNotes: result.responsivenessNotes,
            ctaQuality: result.ctaQuality,
            professionalismScore: result.professionalismScore,
            summary: result.summary,
            weaknesses: result.weaknesses,
            improvements: result.improvements,
            leadQualityScore: result.leadQualityScore,
            conversionOpportunityScore: result.conversionOpportunityScore,
          },
        });

        await tx.businessLead.update({
          where: { id: businessLeadId },
          data: {
            websiteStatus: result.websiteStatus,
            leadScore: result.leadScore,
            websiteUrl: websiteUrl ?? undefined,
          },
        });

        return audit;
      });
    }

    return NextResponse.json({
      websiteStatus: result.websiteStatus,
      leadScore: result.leadScore,
      signals: result.signals,
      homepageTitle: result.homepageTitle,
      metaDescription: result.metaDescription,
      responseStatus: result.responseStatus,
      loadTimeMs: result.loadTimeMs,
      notes: result.notes,
      mobileFriendly: result.mobileFriendly,
      brokenLinks: result.brokenLinks,
      pageSpeedScore: result.pageSpeedScore,
      accessibilityNotes: result.accessibilityNotes,
      seoNotes: result.seoNotes,
      responsivenessNotes: result.responsivenessNotes,
      ctaQuality: result.ctaQuality,
      professionalismScore: result.professionalismScore,
      summary: result.summary,
      weaknesses: result.weaknesses,
      improvements: result.improvements,
      leadQualityScore: result.leadQualityScore,
      conversionOpportunityScore: result.conversionOpportunityScore,
      audit: savedAudit,
    });
  } catch (error) {
    console.error("[audit-website]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Audit failed" },
      { status: 500 }
    );
  }
}
