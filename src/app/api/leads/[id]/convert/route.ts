import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/guards";
import { convertLeadToClient } from "@/lib/clients/conversion";
import { isSessionSuperAdmin } from "@/lib/auth/access";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      overrideDuplicate?: boolean;
    };

    const client = await convertLeadToClient({
      leadId: id,
      session: auth.session,
      overrideDuplicate: isSessionSuperAdmin(auth.session) && body.overrideDuplicate === true,
    });

    return NextResponse.json({ client });
  } catch (error) {
    console.error("[lead convert]", error);
    const message = error instanceof Error ? error.message : "Lead conversion failed";
    const status = message.includes("already linked") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
