import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';

/**
 * Validates whether an email belongs to an allowed college domain.
 */
export const validateCollegeDomain = (email: string): boolean => {
  if (!email || !email.includes('@')) return false;

  const normalized = email.trim().toLowerCase();
  const domain = normalized.split('@')[1];
  if (!domain) return false;

  const envDomains = process.env.ALLOWED_COLLEGE_EMAIL_DOMAINS || process.env.ALLOWED_EMAIL_DOMAINS;
  let allowedDomains = ['akgec.ac.in', 'student.akgec.ac.in'];

  if (process.env.NODE_ENV === 'development') {
    allowedDomains.push('gmail.com');
  }

  if (envDomains) {
    allowedDomains = envDomains.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
  }

  return allowedDomains.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`));
};

/**
 * Generates a cryptographically secure 6-digit OTP string.
 */
export const generateCryptographicOtp = (): string => {
  const num = crypto.randomInt(100000, 1000000);
  return num.toString();
};

/**
 * Computes an HMAC-SHA256 hash of the 6-digit OTP.
 */
export const hashOtp = (otp: string): string => {
  const secret = process.env.OTP_SECRET;
  if (!secret) {
    throw new Error('Server configuration error: OTP_SECRET environment variable is missing.');
  }
  return crypto.createHmac('sha256', secret).update(otp.trim()).digest('hex');
};

/**
 * Generates a deterministic SHA256 challenge ID for an email address.
 */
export const generateChallengeId = (email: string): string => {
  const normalized = email.trim().toLowerCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
};

interface SendOtpEmailParams {
  recipientEmail: string;
  otpCode: string;
  expiryMinutes?: number;
}

/**
 * Creates Nodemailer SMTP transporter using dedicated environment credentials.
 */
const getTransporter = () => {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_APP_PASSWORD;

  if (!smtpUser || !smtpPass) {
    throw new Error('Server configuration error: SMTP credentials are not configured in environment variables.');
  }

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = process.env.SMTP_SECURE !== 'false';

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
};

/**
 * Sends clean, branded College Times OTP verification email via Nodemailer.
 */
export const sendOtpEmail = async ({
  recipientEmail,
  otpCode,
  expiryMinutes = 5,
}: SendOtpEmailParams): Promise<boolean> => {
  const transporter = getTransporter();

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0b0f19; color: #f8fafc; margin: 0; padding: 24px; }
          .container { max-width: 480px; margin: 0 auto; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 24px; padding: 32px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
          .header { text-align: center; margin-bottom: 24px; }
          .title { color: #38bdf8; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; margin: 0; }
          .subtitle { color: #94a3b8; font-size: 13px; margin-top: 4px; }
          .otp-box { background: linear-gradient(135deg, rgba(56, 189, 248, 0.1), rgba(99, 102, 241, 0.1)); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 16px; padding: 20px; text-align: center; margin: 24px 0; }
          .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #38bdf8; margin: 0; }
          .footer { font-size: 12px; color: #64748b; text-align: center; margin-top: 24px; line-height: 1.5; }
          .warning { color: #f43f5e; font-size: 12px; text-align: center; margin-top: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="title">College Times</h1>
            <p class="subtitle">Secure Email Verification</p>
          </div>
          <p style="font-size: 14px; color: #cbd5e1; margin-bottom: 16px;">
            Hello, enter the verification code below to complete your sign-in to College Times.
          </p>
          <div class="otp-box">
            <p class="otp-code">${otpCode}</p>
          </div>
          <p class="warning">
            This code expires in <strong>${expiryMinutes} minutes</strong> and can only be used once.
          </p>
          <div class="footer">
            If you did not request this verification code, please ignore this email.<br>
            © College Times / AKGEC Times Platform.
          </div>
        </div>
      </body>
    </html>
  `;

  const textContent = `College Times Verification Code: ${otpCode}\n\nThis code expires in ${expiryMinutes} minutes. If you did not request this, please ignore this email.`;

  try {
    const smtpUser = process.env.SMTP_USER;
    if (!smtpUser) {
      throw new Error('SMTP_USER environment variable is missing.');
    }

    await transporter.sendMail({
      from: `"College Times Auth" <${smtpUser}>`,
      to: recipientEmail,
      subject: `Your College Times Verification Code`,
      text: textContent,
      html: htmlContent,
    });
    return true;
  } catch (err: any) {
    console.error('Failed to send OTP email via SMTP:', err.message);
    return false;
  }
};
