import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/guards";
import { recommendPricing } from "@/lib/pricing/ai-pricing";

export async function POST(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const input = await request.json();
    const recommendation = await recommendPricing(input);
    return NextResponse.json({ recommendation });
  } catch (error) {
    console.error("[pricing recommend]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Pricing recommendation failed" },
      { status: 500 }
    );
  }
}
