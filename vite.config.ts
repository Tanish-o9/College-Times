import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import * as nodemailer from 'nodemailer';

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

                  console.log(`\n==================================================`);
                  console.log(`[DEV OTP SERVER] Sending real email via SMTP...`);
                  console.log(`Email: ${email}`);
                  console.log(`Code:  ${otp}`);
                  console.log(`==================================================\n`);

                  const smtpUser = env.SMTP_USER || 'collegetimes.auth@gmail.com';
                  const smtpPass = env.SMTP_APP_PASSWORD || 'emnsgufexwcwdhhb';

                  const transporter = nodemailer.createTransport({
                    host: env.SMTP_HOST || 'smtp.gmail.com',
                    port: parseInt(env.SMTP_PORT || '465', 10),
                    secure: env.SMTP_SECURE !== 'false',
                    auth: {
                      user: smtpUser,
                      pass: smtpPass,
                    },
                  });

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
                            <p class="otp-code">${otp}</p>
                          </div>
                          <p class="warning">
                            This code expires in <strong>5 minutes</strong> and can only be used once.
                          </p>
                          <div class="footer">
                            If you did not request this verification code, please ignore this email.<br>
                            © College Times / Platform.
                          </div>
                        </div>
                      </body>
                    </html>
                  `;

                  const textContent = `College Times Verification Code: ${otp}\n\nThis code expires in 5 minutes. If you did not request this, please ignore this email.`;

                  await transporter.sendMail({
                    from: `"College Times Auth" <${smtpUser}>`,
                    to: email,
                    subject: `Your College Times Verification Code`,
                    text: textContent,
                    html: htmlContent,
                  });

                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: true, message: 'OTP sent to email successfully' }));
                } catch (err: any) {
                  console.error('[DEV OTP ERROR]', err.message);
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
