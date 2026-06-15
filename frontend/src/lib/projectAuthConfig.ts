/**
 * TeleBase Project-Level Authentication Config
 * Developers can customize these settings to modify email OTP length, SMTP connection, subject line, and HTML template.
 */

export interface ProjectAuthConfig {
  // OTP Settings
  otpLength: number;          // Default: 6. Recommended: 4 to 8.
  otpExpiryMinutes: number;   // Default: 10 minutes.

  // Auth Modes Enabled
  allowOTP: boolean;          // Enable Email OTP auth
  allowMagicLink: boolean;    // Enable Magic Link auth

  // Custom Magic Link URL format
  // E.g. "https://your-frontend-app.com/verify?token={{token}}"
  magicLinkUrlTemplate: string;

  // Email Customizations
  emailSubjectOTP: string;
  emailSubjectMagicLink: string;

  // SMTP Mail Server Settings (Fallback if RESEND_API_KEY is not configured)
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
  };
}

export const PROJECT_AUTH_CONFIG: ProjectAuthConfig = {
  otpLength: 6,
  otpExpiryMinutes: 10,
  allowOTP: true,
  allowMagicLink: true,

  // For Magic Links, the verification token is appended to this URL
  magicLinkUrlTemplate: "http://https://telebase.pages.dev//api/auth/project/verify?token={{token}}",

  // Email subjects
  emailSubjectOTP: "🔐 Your Verification Code: {{code}}",
  emailSubjectMagicLink: "🔗 Sign in to your account",

  // SMTP Configuration (if developer wants to use direct SMTP)
  smtp: {
    host: process.env.PROJECT_SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.PROJECT_SMTP_PORT) || 465,
    secure: process.env.PROJECT_SMTP_SECURE !== "false", // true for 465, false for other ports
    user: process.env.PROJECT_SMTP_USER || "",           // SMTP username
    pass: process.env.PROJECT_SMTP_PASS || "",           // SMTP password (e.g. App Password)
    from: process.env.PROJECT_SMTP_FROM || "Auth <auth@telebase.dev>",
  }
};

/**
 * Custom HTML Mail Template for OTP
 */
export function generateProjectOTPEmailHTML(otp: string, projectName: string): string {
  return `
  <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
    <h2 style="color: #3b82f6; text-align: center;">${projectName} Authentication</h2>
    <p>Use the following verification code to log in to your account:</p>
    <div style="font-size: 32px; font-weight: bold; text-align: center; letter-spacing: 5px; margin: 25px 0; color: #1e293b; background-color: #f1f5f9; padding: 15px; border-radius: 6px;">
      ${otp}
    </div>
    <p style="font-size: 13px; color: #64748b;">This code will expire in ${PROJECT_AUTH_CONFIG.otpExpiryMinutes} minutes. If you did not request this code, you can safely ignore this email.</p>
  </div>`;
}

/**
 * Custom HTML Mail Template for Magic Link
 */
export function generateProjectMagicLinkEmailHTML(magicLink: string, projectName: string): string {
  return `
  <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
    <h2 style="color: #3b82f6; text-align: center;">${projectName} Sign In</h2>
    <p>Click the button below to log in directly to your account. No password required:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${magicLink}" style="background-color: #3b82f6; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
        Sign In to Account
      </a>
    </div>
    <p style="font-size: 13px; color: #64748b; word-break: break-all;">Or copy and paste this URL into your browser: <br/><a href="${magicLink}">${magicLink}</a></p>
    <p style="font-size: 13px; color: #64748b;">This link will expire in ${PROJECT_AUTH_CONFIG.otpExpiryMinutes} minutes. If you did not request this link, you can safely ignore this email.</p>
  </div>`;
}
