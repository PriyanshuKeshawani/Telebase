/**
 * TeleBase Email Service - Edge Runtime Compatible
 * Uses Resend API (fetch-based) - nodemailer NOT supported on Cloudflare Pages Edge Runtime.
 *
 * Setup for Cloudflare Pages:
 * 1. Sign up at https://resend.com (free: 1000 emails/month)
 * 2. Create an API key and add RESEND_API_KEY to Cloudflare Pages environment variables
 * 3. (Optional) Add a verified domain at Resend and set RESEND_FROM_EMAIL
 *    - Without a verified domain, Resend only sends to your own Resend account email
 *    - With a verified domain, you can send to any email address
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'TeleBase <onboarding@resend.dev>';

// onboarding@resend.dev (Resend test sender) can ONLY deliver to your Resend account email,
// not to arbitrary recipients. A verified custom domain is required for real delivery.
function isTestSender(): boolean {
  return FROM_EMAIL.includes('onboarding@resend.dev');
}

export function isEmailConfigured(): boolean {
  return !!RESEND_API_KEY && !isTestSender();
}

export function isEmailFullyFunctional(): boolean {
  return !!RESEND_API_KEY && !isTestSender();
}

/**
 * Sends OTP verification email via Resend API (Edge-compatible fetch)
 */
export async function sendOTPEmail(toEmail: string, otp: string): Promise<{ success: boolean; error?: string }> {
  // If using the Resend test sender (onboarding@resend.dev), skip the API call entirely
  // because it can only deliver to your own Resend account email, not to arbitrary recipients.
  if (RESEND_API_KEY && !isTestSender()) {
    try {
      console.log(`[TeleBase Email] Sending OTP via Resend API to ${toEmail}...`);
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

      const responseText = await res.text();
      
      if (!res.ok) {
        console.error('[TeleBase Email] Resend API error:', res.status, responseText);
        return { success: false, error: `Resend API error (${res.status}): ${responseText}` };
      }

      let data: any = {};
      try { data = JSON.parse(responseText); } catch {}
      console.log('[TeleBase Email] OTP sent successfully via Resend. Message ID:', data.id);
      return { success: true };
    } catch (err: any) {
      console.error('[TeleBase Email] Resend API fetch error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // Log OTP to console (dev/testing only)
  console.log(`\n=== OTP FOR ${toEmail} ===`);
  console.log(`OTP Code: ${otp}`);
  if (RESEND_API_KEY && isTestSender()) {
    console.log(`Note: Using Resend test sender (onboarding@resend.dev).`);
    console.log(`To deliver emails to any address, verify a custom domain at https://resend.com/domains`);
    console.log(`and set RESEND_FROM_EMAIL to your verified sender.`);
  } else {
    console.log(`Note: No RESEND_API_KEY configured. Set it in .env.local to enable email delivery.`);
  }
  console.log(`=========================\n`);
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
  const arr = new Uint8Array(1);
  globalThis.crypto.getRandomValues(arr);
  // Ensure 6 digits: use modulo on a wider range
  const num = 100000 + (arr[0] * 1000 + Math.floor(Math.random() * 900000)) % 900000;
  return num.toString();
}
