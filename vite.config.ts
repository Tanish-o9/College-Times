import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(() => {
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
                  console.log(`[DEV OTP SERVER] OTP Code generated for local testing:`);
                  console.log(`Email: ${email}`);
                  console.log(`Code:  ${otp}`);
                  console.log(`==================================================\n`);

                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: true, message: 'OTP logged to server console' }));
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
