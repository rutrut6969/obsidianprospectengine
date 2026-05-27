import { NextRequest, NextResponse } from "next/server";
import { TemplateType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/guards";
import { isSessionSuperAdmin } from "@/lib/auth/access";
import { getActiveTemplate } from "@/lib/outreach/email-template";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  await getActiveTemplate("COLD_OUTREACH");

  const templates = await prisma.emailTemplate.findMany({
    where: isSessionSuperAdmin(auth.session)
      ? {}
      : {
          OR: [
            { isSystem: true },
            { ownerId: null },
            { ownerId: auth.session.userId },
          ],
        },
    orderBy: [{ type: "asc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json({ templates });
}

export async function POST(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const body = (await request.json()) as {
      name?: string;
      type?: TemplateType;
      subject?: string;
      html?: string;
      text?: string;
      isActive?: boolean;
    };
    if (!body.name?.trim() || !body.subject?.trim() || !body.html?.trim() || !body.text?.trim()) {
      return NextResponse.json(
        { error: "Name, subject, HTML, and text are required." },
        { status: 400 }
      );
    }

    const template = await prisma.emailTemplate.create({
      data: {
        ownerId: isSessionSuperAdmin(auth.session) ? null : auth.session.userId,
        name: body.name.trim(),
        type: body.type ?? "COLD_OUTREACH",
        subject: body.subject.trim(),
        html: body.html,
        text: body.text,
        isActive: body.isActive ?? true,
        isSystem: isSessionSuperAdmin(auth.session),
      },
    });

    return NextResponse.json({ template });
  } catch (error) {
    console.error("[templates POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Template create failed" },
      { status: 500 }
    );
  }
}
