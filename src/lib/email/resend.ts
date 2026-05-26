import { Resend } from "resend";
import { getAppUrl } from "@/lib/auth/constants";

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error(
      "RESEND_API_KEY is not set. Add it in Vercel to send invite emails."
    );
  }
  return new Resend(key);
}

function getFromAddress(): string {
  return (
    process.env.RESEND_FROM_EMAIL ??
    "Obsidian Prospect Engine <onboarding@resend.dev>"
  );
}

export async function sendInviteEmail(params: {
  to: string;
  inviteUrl: string;
  invitedByEmail: string;
}): Promise<void> {
  const resend = getResend();
  const appUrl = getAppUrl();

  const { error } = await resend.emails.send({
    from: getFromAddress(),
    to: params.to,
    subject: "You're invited to Obsidian Prospect Engine",
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
        <h1 style="color: #a855f7; font-size: 20px;">Obsidian Prospect Engine</h1>
        <p style="color: #334155; line-height: 1.6;">
          <strong>${params.invitedByEmail}</strong> invited you to access the internal lead generation tool for Obsidian Systems LLC.
        </p>
        <p style="color: #334155; line-height: 1.6;">
          Click the button below to authorize your email and create your password. This link expires in 7 days.
        </p>
        <p style="margin: 32px 0;">
          <a href="${params.inviteUrl}" style="background: #7c3aed; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Authorize &amp; Set Up Account
          </a>
        </p>
        <p style="color: #94a3b8; font-size: 12px;">
          If the button doesn't work, copy this link:<br />
          <a href="${params.inviteUrl}">${params.inviteUrl}</a>
        </p>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
          App: <a href="${appUrl}">${appUrl}</a>
        </p>
      </div>
    `,
  });

  if (error) {
    throw new Error(error.message);
  }
}
