import { ContactMethod } from "@prisma/client";

type Env = Record<string, string | undefined>;

export interface OutreachEmailRecipientSource {
  primaryEmail: string | null;
  contactMethods?: Array<Pick<ContactMethod, "type" | "value" | "isPrimary" | "confidence">>;
}

export interface OutreachEmailRecipient {
  to: string;
  isTestOverride: boolean;
  warning: string | null;
}

export function getOutboundFromAddress(env: Env = process.env): string {
  return (
    env.RESEND_OUTREACH_FROM_EMAIL ??
    env.RESEND_FROM_EMAIL ??
    "Obsidian Systems <sales@obsidian-systems.tech>"
  );
}

export function getOutreachTestOverride(env: Env = process.env): string | null {
  const override = env.OUTREACH_TEST_TO_EMAIL?.trim();
  if (!override) return null;

  if (env.NODE_ENV === "production" && env.OUTREACH_ALLOW_TEST_OVERRIDE !== "true") {
    return null;
  }

  return override;
}

export function getOutreachTestOverrideWarning(env: Env = process.env): string | null {
  if (
    env.NODE_ENV === "production" &&
    env.OUTREACH_TEST_TO_EMAIL?.trim() &&
    env.OUTREACH_ALLOW_TEST_OVERRIDE !== "true"
  ) {
    return "OUTREACH_TEST_TO_EMAIL is set but ignored in production unless OUTREACH_ALLOW_TEST_OVERRIDE=true.";
  }

  return null;
}

export function resolveOutreachEmailRecipient(
  lead: OutreachEmailRecipientSource,
  env: Env = process.env
): OutreachEmailRecipient | null {
  const override = getOutreachTestOverride(env);
  if (override) {
    return {
      to: override,
      isTestOverride: true,
      warning: "OUTREACH_TEST_TO_EMAIL override is active. Real lead recipient was not used.",
    };
  }

  const primaryEmail = lead.primaryEmail?.trim();
  if (primaryEmail) {
    return {
      to: primaryEmail,
      isTestOverride: false,
      warning: getOutreachTestOverrideWarning(env),
    };
  }

  const discoveredEmail = lead.contactMethods
    ?.filter((method) => method.type === "EMAIL")
    .sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return (b.confidence ?? 0) - (a.confidence ?? 0);
    })[0]?.value.trim();

  if (discoveredEmail) {
    return {
      to: discoveredEmail,
      isTestOverride: false,
      warning: getOutreachTestOverrideWarning(env),
    };
  }

  return null;
}

