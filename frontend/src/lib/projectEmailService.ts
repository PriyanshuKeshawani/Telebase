import { PROJECT_AUTH_CONFIG } from './projectAuthConfig';

// Node.js conditional require for nodemailer to prevent Edge runtime compile failures
const nodemailer = typeof window === 'undefined' && process.env.NEXT_RUNTIME !== 'edge' ? require('nodemailer') : null;

export async function sendProjectEmail(options: {
  toEmail: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { toEmail, subject, html, text } = options;

  // 1. Try Resend API first if RESEND_API_KEY is configured
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'TeleBase <onboarding@resend.dev>';
  
  if (resendApiKey && !fromEmail.includes('onboarding@resend.dev')) {
    try {
      console.log(`[Project Auth Email] Sending email via Resend API to ${toEmail}...`);
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [toEmail],
          subject: subject,
          html: html,
        }),
      });

      const responseText = await res.text();
      if (res.ok) {
        return { success: true };
      }
      console.warn(`[Project Auth Email] Resend API failed: ${responseText}`);
    } catch (err: any) {
      console.error('[Project Auth Email] Resend API error:', err.message);
    }
  }

  // 2. Try SMTP via Nodemailer (if supported in runtime)
  const smtpConfig = PROJECT_AUTH_CONFIG.smtp;
  if (smtpConfig.user && smtpConfig.pass) {
    if (nodemailer) {
      try {
        console.log(`[Project Auth Email] Sending email via SMTP to ${toEmail}...`);
        const transporter = nodemailer.createTransport({
          host: smtpConfig.host,
          port: smtpConfig.port,
          secure: smtpConfig.secure,
          auth: {
            user: smtpConfig.user,
            pass: smtpConfig.pass,
          },
        });

        await transporter.sendMail({
          from: smtpConfig.from,
          to: toEmail,
          subject: subject,
          html: html,
          text: text || "Please check your email in an HTML compatible client.",
        });

        console.log('[Project Auth Email] Email sent successfully via SMTP!');
        return { success: true };
      } catch (err: any) {
        console.error('[Project Auth Email] SMTP nodemailer failed:', err.message);
      }
    } else {
      console.warn('[Project Auth Email] SMTP configured but nodemailer is not available in the current runtime (Edge Runtime).');
    }
  }

  // 3. Fallback: print to console for development / zero-config testing
  console.log(`\n==================================================`);
  console.log(`✉️  [Project Auth Email Fallback Log]`);
  console.log(`To: ${toEmail}`);
  console.log(`Subject: ${subject}`);
  console.log(`HTML Body Preview:`);
  console.log(html.substring(0, 500) + (html.length > 500 ? '...' : ''));
  console.log(`==================================================\n`);

  return { 
    success: true, 
    error: "Email simulated in console log. Configure RESEND_API_KEY or SMTP credentials to send real emails." 
  };
}
