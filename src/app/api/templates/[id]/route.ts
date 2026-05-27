import { NextRequest, NextResponse } from "next/server";
import { TemplateType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/guards";
import { isSessionSuperAdmin } from "@/lib/auth/access";

type RouteContext = { params: Promise<{ id: string }> };

async function getEditableTemplate(id: string, userId: string, isAdmin: boolean) {
  return prisma.emailTemplate.findFirst({
    where: { id, ...(isAdmin ? {} : { ownerId: userId }) },
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const { id } = await context.params;
    const isAdmin = isSessionSuperAdmin(auth.session);
    const existing = await getEditableTemplate(id, auth.session.userId, isAdmin);
    if (!existing) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    const body = (await request.json()) as {
      name?: string;
      type?: TemplateType;
      subject?: string;
      html?: string;
      text?: string;
      isActive?: boolean;
    };

    const template = await prisma.emailTemplate.update({
      where: { id },
      data: {
        ...(body.name?.trim() && { name: body.name.trim() }),
        ...(body.type && { type: body.type }),
        ...(body.subject?.trim() && { subject: body.subject.trim() }),
        ...(body.html !== undefined && { html: body.html }),
        ...(body.text !== undefined && { text: body.text }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });

    return NextResponse.json({ template });
  } catch (error) {
    console.error("[templates PATCH]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Template update failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const { id } = await context.params;
    const isAdmin = isSessionSuperAdmin(auth.session);
    const existing = await getEditableTemplate(id, auth.session.userId, isAdmin);
    if (!existing) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    const template = await prisma.emailTemplate.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ template });
  } catch (error) {
    console.error("[templates DELETE]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Template delete failed" },
      { status: 500 }
    );
  }
}
