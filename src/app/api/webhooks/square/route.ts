import { NextRequest, NextResponse } from "next/server";
import {
  processSquareWebhook,
  SquareWebhookPayload,
  verifySquareSignature,
} from "@/lib/square/webhook";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-square-hmacsha256-signature");

  if (!verifySquareSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid Square signature" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody) as SquareWebhookPayload;
    const result = await processSquareWebhook(payload);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("[square webhook]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook processing failed" },
      { status: 500 }
    );
  }
}
