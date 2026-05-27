export interface PricingInput {
  pageCount?: number;
  ecommerce?: boolean;
  customFeatures?: string[];
  integrations?: string[];
  bookingSystem?: boolean;
  userAccounts?: boolean;
  urgency?: string | null;
}

export interface PricingRecommendation {
  suggestedUpfrontCost: number;
  suggestedRetainer: number;
  pricingExplanation: string;
  complexityScore: number;
  provider: "openai" | "fallback";
}

function fallbackPricing(input: PricingInput): PricingRecommendation {
  const pageCount = Math.max(1, Number(input.pageCount ?? 5));
  let complexityScore = 20 + pageCount * 5;
  if (input.ecommerce) complexityScore += 25;
  if (input.bookingSystem) complexityScore += 12;
  if (input.userAccounts) complexityScore += 18;
  complexityScore += (input.customFeatures?.length ?? 0) * 8;
  complexityScore += (input.integrations?.length ?? 0) * 10;
  if (input.urgency?.toLowerCase().includes("rush")) complexityScore += 10;
  complexityScore = Math.min(100, complexityScore);

  const suggestedUpfrontCost = Math.round((1200 + pageCount * 250 + complexityScore * 35) / 50) * 50;
  const suggestedRetainer = Math.round((150 + complexityScore * 4) / 25) * 25;

  return {
    suggestedUpfrontCost,
    suggestedRetainer,
    complexityScore,
    pricingExplanation:
      "Fallback pricing uses page count, ecommerce, accounts, booking, custom features, integrations, and urgency. OpenAI can refine this when configured.",
    provider: "fallback",
  };
}

export async function recommendPricing(input: PricingInput): Promise<PricingRecommendation> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallbackPricing(input);

  const fallback = fallbackPricing(input);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_PRICING_MODEL ?? "gpt-5-mini",
        instructions:
          "Recommend practical small-business website pricing. Return valid JSON only.",
        input: JSON.stringify({
          project: input,
          shape: {
            suggestedUpfrontCost: "number",
            suggestedRetainer: "number",
            pricingExplanation: "string",
            complexityScore: "integer 0-100",
          },
        }),
      }),
    });
    if (!response.ok) return fallback;
    const data = (await response.json()) as { output_text?: string };
    const parsed = JSON.parse(data.output_text ?? "{}") as Partial<PricingRecommendation>;
    return {
      suggestedUpfrontCost: Number(parsed.suggestedUpfrontCost ?? fallback.suggestedUpfrontCost),
      suggestedRetainer: Number(parsed.suggestedRetainer ?? fallback.suggestedRetainer),
      pricingExplanation: parsed.pricingExplanation ?? fallback.pricingExplanation,
      complexityScore: Number(parsed.complexityScore ?? fallback.complexityScore),
      provider: "openai",
    };
  } catch {
    return fallback;
  }
}
