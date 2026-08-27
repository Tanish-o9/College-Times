import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
// @ts-ignore
import nodemailer from './functions/node_modules/nodemailer/lib/nodemailer.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      {
        name: 'local-email-otp-server',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url === '/api/send-email-otp' && req.method === 'POST') {
              let body = '';
              req.on('data', (chunk) => {
                body += chunk.toString();
              });

              req.on('end', async () => {
                try {
                  const { email, otp } = JSON.parse(body || '{}');
                  if (!email || !otp) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'Email and OTP required' }));
                    return;
                  }

                  const smtpUser = env.SMTP_USER;
                  const smtpPass = env.SMTP_APP_PASSWORD;

                  if (!smtpUser || !smtpPass) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: 'SMTP credentials missing in .env' }));
                    return;
                  }

                  const transporter = nodemailer.createTransport({
                    host: 'smtp.gmail.com',
                    port: 465,
                    secure: true,
                    auth: { user: smtpUser, pass: smtpPass },
                  });

                  await transporter.sendMail({
                    from: `"College Times Auth" <${smtpUser}>`,
                    to: email,
                    subject: `Your College Times Verification Code is ${otp}`,
                    text: `College Times Verification Code: ${otp}\n\nThis code expires in 5 minutes.`,
                    html: `
                      <div style="font-family: Arial, sans-serif; background-color: #0f172a; padding: 24px; color: #f8fafc; border-radius: 16px;">
                        <h2 style="color: #38bdf8;">College Times Verification Code</h2>
                        <p style="font-size: 14px; color: #cbd5e1;">Enter this code to complete your sign-in to College Times:</p>
                        <div style="background-color: #1e293b; padding: 16px; border-radius: 12px; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #38bdf8; text-align: center; margin: 16px 0;">
                          ${otp}
                        </div>
                        <p style="font-size: 12px; color: #94a3b8;">This code expires in 5 minutes and can only be used once.</p>
                      </div>
                    `,
                  });

                  console.log(`[REAL GMAIL SENT] OTP ${otp} delivered via Nodemailer to ${email}`);
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: true, message: 'OTP sent to email inbox' }));
                } catch (err: any) {
                  console.error('[REAL GMAIL ERROR]', err.message);
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: err.message }));
                }
              });
            } else {
              next();
            }
          });
        },
      },
    ],
  };
});
