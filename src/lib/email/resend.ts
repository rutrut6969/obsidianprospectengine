import { Resend } from "resend";
import { getAppUrl } from "@/lib/auth/constants";

interface InviteEmailParams {
  to: string;
  fullName?: string | null;
  inviteUrl: string;
}

interface EmailSendResult {
  sent: boolean;
  messageId: string | null;
  error: string | null;
}

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("[resend] Missing RESEND_API_KEY. Invite email was not sent.");
    return null;
  }
  return new Resend(key);
}

function getFromAddress(): string {
  const sender =
    process.env.RESEND_FROM_EMAIL ?? "Obsidian Systems <sales@obsidian-systems.tech>";
  if (!process.env.RESEND_FROM_EMAIL) {
    console.warn(
      "[resend] RESEND_FROM_EMAIL is not set. Falling back to Obsidian Systems <sales@obsidian-systems.tech>."
    );
  }
  return sender;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function sendLeadGeneratorInviteEmail({
  to,
  fullName,
  inviteUrl,
}: InviteEmailParams): Promise<EmailSendResult> {
  const resend = getResend();
  if (!resend) {
    return {
      sent: false,
      messageId: null,
      error: "RESEND_API_KEY is not configured.",
    };
  }

  const appUrl = getAppUrl();
  const from = getFromAddress();
  const safeName = escapeHtml(fullName?.trim() || "there");
  const safeInviteUrl = escapeHtml(inviteUrl);
  const safeAppUrl = escapeHtml(appUrl);

  try {
    const response = await resend.emails.send({
      from,
      to,
      subject: "You're invited to Obsidian Prospect Engine",
      html: `
        <div style="margin:0;background:#020617;padding:32px 16px;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e8f0;">
          <div style="max-width:600px;margin:0 auto;border:1px solid #1e293b;border-radius:16px;background:#0f172a;overflow:hidden;">
            <div style="padding:24px;border-bottom:1px solid #1e293b;">
              <p style="margin:0 0 4px;color:#a855f7;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Obsidian Systems</p>
              <h1 style="margin:0;color:#f8fafc;font-size:22px;line-height:1.2;">Set up your Prospect Engine account</h1>
            </div>
            <div style="padding:24px;">
              <p style="margin:0 0 16px;line-height:1.6;color:#cbd5e1;">Hi ${safeName},</p>
              <p style="margin:0 0 16px;line-height:1.6;color:#cbd5e1;">
                You have been invited to access Obsidian Prospect Engine for Obsidian Systems LLC.
              </p>
              <p style="margin:0 0 24px;line-height:1.6;color:#cbd5e1;">
                Use the secure setup link below to authorize your email and create your password. This link expires in 7 days.
              </p>
              <p style="margin:0 0 24px;">
                <a href="${safeInviteUrl}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700;">
                  Authorize &amp; Set Up Account
                </a>
              </p>
              <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">
                If the button does not work, copy this link:<br />
                <a href="${safeInviteUrl}" style="color:#a78bfa;">${safeInviteUrl}</a>
              </p>
            </div>
            <div style="padding:18px 24px;border-top:1px solid #1e293b;color:#64748b;font-size:12px;">
              <p style="margin:0;">App: <a href="${safeAppUrl}" style="color:#94a3b8;">${safeAppUrl}</a></p>
            </div>
          </div>
        </div>
      `,
    });

    console.info("[resend] Lead generator invite response", {
      to,
      from,
      messageId: response.data?.id ?? null,
      error: response.error ?? null,
    });

    if (response.error) {
      return {
        sent: false,
        messageId: null,
        error: response.error.message,
      };
    }

    return {
      sent: true,
      messageId: response.data?.id ?? null,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resend invite email failed.";
    console.error("[resend] Lead generator invite error", {
      to,
      from,
      error: message,
    });
    return {
      sent: false,
      messageId: null,
      error: message,
    };
  }
}

export async function sendInviteEmail(params: {
  to: string;
  inviteUrl: string;
  invitedByEmail: string;
}): Promise<void> {
  const result = await sendLeadGeneratorInviteEmail({
    to: params.to,
    inviteUrl: params.inviteUrl,
  });

  if (!result.sent) throw new Error(result.error ?? "Invite email failed.");
}
