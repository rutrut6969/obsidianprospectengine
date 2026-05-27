import { NextRequest, NextResponse } from "next/server";
import { WebsiteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { milesToMeters, searchPlaces } from "@/lib/google-places";
import { auditWebsite } from "@/lib/website-audit";
import { requireSession } from "@/lib/auth/guards";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const {
      category,
      city,
      state,
      radius = 10,
      maxResults = 20,
      auditWebsites = true,
    } = body as {
      category?: string;
      city?: string;
      state?: string;
      radius?: number;
      maxResults?: number;
      auditWebsites?: boolean;
    };

    if (!category?.trim() || !city?.trim() || !state?.trim()) {
      return NextResponse.json(
        { error: "category, city, and state are required" },
        { status: 400 }
      );
    }

    const radiusMeters = milesToMeters(Number(radius) || 10);
    const limit = Math.min(Math.max(Number(maxResults) || 20, 1), 60);

    const places = await searchPlaces({
      category: category.trim(),
      city: city.trim(),
      state: state.trim().toUpperCase(),
      radiusMeters,
      maxResults: limit,
    });

    const searchRun = await prisma.searchRun.create({
      data: {
        userId: auth.session.userId,
        query: category.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase(),
        radius: Number(radius) || 10,
        maxResults: limit,
        resultCount: places.length,
      },
    });

    const leads = await Promise.all(
      places.map(async (place) => {
        let websiteStatus: WebsiteStatus = "UNKNOWN";
        let leadScore = 50;
        let audit = null;

        if (auditWebsites) {
          const auditResult = await auditWebsite(place.websiteUrl);
          websiteStatus = auditResult.websiteStatus;
          leadScore = auditResult.leadScore;
          audit = {
            hasWebsite: auditResult.signals.hasWebsite,
            isBroken: auditResult.signals.isBroken,
            isHttps: auditResult.signals.isHttps,
            isFacebookOnly: auditResult.signals.isFacebookOnly,
            homepageTitle: auditResult.homepageTitle,
            metaDescription: auditResult.metaDescription,
            responseStatus: auditResult.responseStatus,
            loadTimeMs: auditResult.loadTimeMs,
            notes: auditResult.notes,
            mobileFriendly: auditResult.mobileFriendly,
            brokenLinks: auditResult.brokenLinks,
            pageSpeedScore: auditResult.pageSpeedScore,
            accessibilityNotes: auditResult.accessibilityNotes,
            seoNotes: auditResult.seoNotes,
            responsivenessNotes: auditResult.responsivenessNotes,
            ctaQuality: auditResult.ctaQuality,
            professionalismScore: auditResult.professionalismScore,
            summary: auditResult.summary,
            weaknesses: auditResult.weaknesses,
            improvements: auditResult.improvements,
            leadQualityScore: auditResult.leadQualityScore,
            conversionOpportunityScore: auditResult.conversionOpportunityScore,
          };
        } else if (!place.websiteUrl) {
          websiteStatus = "NO_WEBSITE";
          leadScore = 100;
        } else {
          websiteStatus = "HAS_WEBSITE";
          leadScore = 20;
        }

        return {
          placeId: place.placeId,
          name: place.name,
          category: place.category,
          address: place.address,
          city: place.city,
          state: place.state,
          phone: place.phone,
          websiteUrl: place.websiteUrl,
          googleMapsUrl: place.googleMapsUrl,
          rating: place.rating,
          reviewCount: place.reviewCount,
          websiteStatus,
          leadScore,
          businessStatus: place.businessStatus,
          types: place.types,
          audit,
        };
      })
    );

    return NextResponse.json({
      searchRunId: searchRun.id,
      resultCount: leads.length,
      leads,
    });
  } catch (error) {
    console.error("[search-leads]", error);
    const message =
      error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
