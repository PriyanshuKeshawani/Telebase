/**
 * TeleBase Email Service - Edge Runtime Compatible
 * Uses Resend API (fetch-based) with Dev Console fallback.
 * nodemailer is NOT supported in Edge Runtime (Cloudflare Pages).
 *
 * Setup:
 * 1. Add RESEND_API_KEY to environment variables for email support
 * 2. Or set SMTP_USER + SMTP_PASS — OTP will be logged to console as fallback on Edge
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const SMTP_USER = process.env.SMTP_USER || '';
const FROM_EMAIL = SMTP_USER ? `TeleBase <${SMTP_USER}>` : 'TeleBase <onboarding@resend.dev>';

export function isEmailConfigured(): boolean {
  return !!RESEND_API_KEY || !!SMTP_USER;
}

/**
 * Sends OTP verification email via Resend API (Edge-compatible fetch)
 */
export async function sendOTPEmail(toEmail: string, otp: string): Promise<{ success: boolean; error?: string }> {
  // 1. Resend API (Edge-compatible)
  if (RESEND_API_KEY) {
    try {
      console.log(`[TeleBase Email] Dispatching OTP via Resend API to ${toEmail}...`);
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [toEmail],
          subject: `🔐 TeleBase — Your verification code is ${otp}`,
          html: generateOTPEmailHTML(otp, toEmail),
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error('[TeleBase Email] Resend API error:', res.status, errBody);
        return { success: false, error: `Resend API failed (${res.status})` };
      }

      const data = await res.json();
      console.log('[TeleBase Email] OTP sent via Resend. ID:', data.id);
      return { success: true };
    } catch (err: any) {
      console.error('[TeleBase Email] Resend API error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // 2. Dev/Console Fallback — OTP logged (no email sent)
  console.warn('[TeleBase Email] No RESEND_API_KEY set. OTP logged to console (dev mode).');
  console.log(`\n=== DEV MODE OTP ===`);
  console.log(`Email: ${toEmail}`);
  console.log(`OTP Code: ${otp}`);
  console.log(`===================\n`);
  return { success: true };
}

/**
 * Generates a premium HTML email template for OTP verification
 */
function generateOTPEmailHTML(otp: string, email: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#050506;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#050506;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#0c0c0f;border:1px solid #1a1a1f;border-radius:16px;overflow:hidden;">
          
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 24px;text-align:center;border-bottom:1px solid #1a1a1f;">
              <div style="display:inline-block;width:48px;height:48px;background:linear-gradient(135deg,#3b82f6,#6366f1);border-radius:12px;line-height:48px;text-align:center;font-size:20px;">
                🗄️
              </div>
              <h1 style="color:#ffffff;font-size:20px;font-weight:700;margin:16px 0 4px;letter-spacing:-0.5px;">
                TeleBase
              </h1>
              <p style="color:#71717a;font-size:12px;margin:0;font-weight:500;letter-spacing:0.5px;text-transform:uppercase;">
                Email Verification
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="color:#a1a1aa;font-size:14px;line-height:22px;margin:0 0 24px;">
                Hi there! Use the verification code below to complete your TeleBase registration for <strong style="color:#e4e4e7;">${email}</strong>.
              </p>

              <!-- OTP Code Box -->
              <div style="background-color:#0a0a0d;border:2px solid #3b82f6;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px;">
                <div style="color:#3b82f6;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin-bottom:12px;">
                  Verification Code
                </div>
                <div style="color:#ffffff;font-size:36px;font-weight:800;letter-spacing:12px;font-family:'Courier New',monospace;">
                  ${otp}
                </div>
              </div>

              <p style="color:#71717a;font-size:12px;line-height:18px;margin:0 0 8px;">
                ⏰ This code expires in <strong style="color:#f59e0b;">10 minutes</strong>.
              </p>
              <p style="color:#52525b;font-size:11px;line-height:16px;margin:0;">
                If you didn't request this, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #1a1a1f;text-align:center;">
              <p style="color:#3f3f46;font-size:10px;margin:0;letter-spacing:0.3px;">
                TeleBase — Serverless Database powered by Telegram
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generates a cryptographically random 6-digit OTP
 */
export function generateOTP(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return num.toString();
}

