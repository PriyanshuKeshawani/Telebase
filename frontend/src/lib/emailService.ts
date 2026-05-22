import nodemailer from 'nodemailer';

/**
 * TeleBase Email Service
 * Uses Google SMTP (Gmail) via nodemailer, with Resend API fallback, and Dev Console fallback.
 * 
 * Setup:
 * 1. Google SMTP:
 *    Add SMTP_USER and SMTP_PASS (Google App Password) to .env.local
 * 2. Resend API:
 *    Add RESEND_API_KEY to .env.local
 */

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true' || SMTP_PORT === 465;
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'TeleBase <onboarding@resend.dev>';

export function isEmailConfigured(): boolean {
  return (!!SMTP_USER && !!SMTP_PASS) || !!RESEND_API_KEY;
}

/**
 * Sends OTP verification email
 */
export async function sendOTPEmail(toEmail: string, otp: string): Promise<{ success: boolean; error?: string }> {
  const isSMTP = !!SMTP_USER && !!SMTP_PASS;

  // 1. Fallback: Dev Mode (If no email provider is configured)
  if (!isSMTP && !RESEND_API_KEY) {
    console.warn('[TeleBase Email] Neither Google SMTP nor Resend API is configured. OTP logged to console.');
    console.log(`\n=== DEV MODE OTP ===`);
    console.log(`Email: ${toEmail}`);
    console.log(`OTP Code: ${otp}`);
    console.log(`===================\n`);
    return { success: true };
  }

  // 2. Google SMTP (Preferred)
  if (isSMTP) {
    try {
      console.log(`[TeleBase Email] Dispatching OTP via Gmail SMTP to ${toEmail}...`);
      
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
      });

      // Construct a valid from-header using the SMTP user
      const fromHeader = FROM_EMAIL.includes('<') && FROM_EMAIL.toLowerCase().includes('onboarding@resend.dev')
        ? `TeleBase <${SMTP_USER}>`
        : FROM_EMAIL;

      await transporter.sendMail({
        from: fromHeader,
        to: toEmail,
        subject: `🔐 TeleBase — Your verification code is ${otp}`,
        html: generateOTPEmailHTML(otp, toEmail),
      });

      console.log('[TeleBase Email] OTP sent successfully via Gmail SMTP.');
      return { success: true };
    } catch (err: any) {
      console.error('[TeleBase Email] Google SMTP failed:', err.message || err);
      
      // Fallback to Resend if SMTP fails and Resend is available
      if (RESEND_API_KEY) {
        console.warn('[TeleBase Email] SMTP failed. Falling back to Resend API...');
      } else {
        return { success: false, error: `SMTP Error: ${err.message}` };
      }
    }
  }

  // 3. Resend API (Fallback)
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
    console.log('[TeleBase Email] OTP sent successfully via Resend API. ID:', data.id);
    return { success: true };
  } catch (err: any) {
    console.error('[TeleBase Email] Resend API network error:', err.message);
    return { success: false, error: err.message };
  }
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

