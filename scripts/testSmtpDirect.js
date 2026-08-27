import nodemailer from '../functions/node_modules/nodemailer/lib/nodemailer.js';
import fs from 'fs';
import path from 'path';

const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v) envVars[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});

const user = envVars.SMTP_USER;
const pass = envVars.SMTP_APP_PASSWORD;

console.log('Testing Nodemailer Direct SMTP Connection...');
console.log(`SMTP User: ${user ? user.slice(0, 5) + '***' : 'NOT FOUND'}`);

if (!user || !pass) {
  console.error('ERROR: SMTP credentials missing.');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user, pass }
});

transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP Connection Error:', error.message);
  } else {
    console.log('🎉 ✔ SUCCESS! Gmail SMTP Server is 100% connected and ready to send emails!');
  }
});
