import nodemailer from 'nodemailer';

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const LOGO_URL = 'https://aihiringpath.in/logo-icon.png';

let transporter = null;
function getTransporter() {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });
  }
  return transporter;
}

export function isConfigured() {
  return Boolean(GMAIL_USER && GMAIL_APP_PASSWORD);
}

export async function sendMail({ to, subject, html }) {
  const t = getTransporter();
  if (!t) return { skipped: true };
  return t.sendMail({ from: `"AI Hiring Path" <${GMAIL_USER}>`, to, subject, html });
}

function layout(bodyHtml) {
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#ddd3c4;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ddd3c4;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#171310;padding:24px 32px;" align="left">
          <img src="${LOGO_URL}" width="32" height="32" alt="AI Hiring Path" style="display:block;" />
        </td></tr>
        <tr><td style="padding:32px;">
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #e6ddd0;">
          <p style="margin:0;font-size:12px;color:#8f8478;">AI Hiring Path &middot; <a href="https://aihiringpath.in" style="color:#b98a2e;text-decoration:none;">aihiringpath.in</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function welcomeEmailHtml({ name }) {
  return layout(`
    <h1 style="margin:0 0 16px;font-size:20px;color:#171310;">Welcome, ${name} 👋</h1>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#45392c;">Your AI Hiring Path account is ready. You've been started on a <strong>3-month Premium trial</strong> — no card needed.</p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#45392c;">Here's what you can do right away:</p>
    <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;line-height:1.8;color:#45392c;">
      <li>Score your resume against real ATS parsing rules</li>
      <li>Run a proctored mock interview or a skills assessment</li>
      <li>Get a personalized career roadmap</li>
    </ul>
    <a href="https://aihiringpath.in/dashboard" style="display:inline-block;background:#f2a93c;color:#171310;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:6px;">Go to your dashboard</a>
  `);
}

export function paymentReceiptEmailHtml({ name, planName, amount, currency, paymentId, orderId, date }) {
  const amountFormatted = `${currency === 'INR' ? '₹' : currency + ' '}${amount}`;
  const row = (label, value) => `
    <tr>
      <td style="padding:8px 0;font-size:13px;color:#8f8478;">${label}</td>
      <td style="padding:8px 0;font-size:13px;color:#171310;text-align:right;font-weight:600;">${value}</td>
    </tr>`;
  return layout(`
    <h1 style="margin:0 0 6px;font-size:20px;color:#171310;">Payment received ✓</h1>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#45392c;">Hi ${name}, thanks for upgrading — your <strong>${planName}</strong> plan is now active.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e6ddd0;border-bottom:1px solid #e6ddd0;margin-bottom:24px;">
      ${row('Plan', planName)}
      ${row('Amount paid', amountFormatted)}
      ${row('Payment ID', paymentId)}
      ${row('Order ID', orderId)}
      ${row('Date', date)}
      ${row('Status', 'Paid')}
    </table>
    <p style="margin:0 0 20px;font-size:12px;line-height:1.6;color:#8f8478;">This email serves as your receipt for the above transaction. Keep it for your records.</p>
    <a href="https://aihiringpath.in/dashboard" style="display:inline-block;background:#f2a93c;color:#171310;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:6px;">Go to your dashboard</a>
  `);
}
