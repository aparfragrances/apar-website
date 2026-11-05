// Sends email through an HTTP email service (Cloudflare cannot use SMTP).
// Set ONE of these in Cloudflare → Settings → Variables and Secrets:
//   BREVO_API_KEY        (brevo.com, 300 emails/day free)
//   ZEPTOMAIL_TOKEN      (zeptomail.zoho.in, Zoho's sending service; use the "Send Mail Token")
// plus MAIL_FROM, e.g.  APAR <orders@aparfragrances.com>
import { bytesToB64 } from './fs.js';

export const mailReady = env => !!(env.BREVO_API_KEY || env.ZEPTOMAIL_TOKEN);

function parseFrom(env) {
  const raw = env.MAIL_FROM || 'APAR <aparfragrances@gmail.com>';
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(raw);
  return m ? { name: m[1] || 'APAR', email: m[2] } : { name: 'APAR', email: raw.trim() };
}
const toB64 = c => typeof c === 'string' ? c : bytesToB64(c instanceof Uint8Array ? c : new Uint8Array(c));

export async function sendMail(env, to, subject, html, attachments) {
  if (!mailReady(env) || !to) return false;
  const from = parseFrom(env);
  try {
    let r;
    if (env.BREVO_API_KEY) {
      r = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST', headers: { 'api-key': env.BREVO_API_KEY.trim(), 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ sender: from, to: [{ email: to }], subject, htmlContent: html, attachment: attachments && attachments.length ? attachments.map(a => ({ name: a.filename, content: toB64(a.content) })) : undefined })
      });
    } else {
      const tok = env.ZEPTOMAIL_TOKEN.trim().replace(/^Zoho-enczapikey\s+/i, '');
      r = await fetch((env.ZEPTOMAIL_URL || 'https://api.zeptomail.in') + '/v1.1/email', {
        method: 'POST', headers: { Authorization: 'Zoho-enczapikey ' + tok, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ from: { address: from.email, name: from.name }, to: [{ email_address: { address: to } }], subject, htmlbody: html,
          attachments: attachments && attachments.length ? attachments.map(a => ({ name: a.filename, mime_type: a.contentType || 'application/pdf', content: toB64(a.content) })) : undefined })
      });
    }
    if (!r.ok) { console.error('mail failed', r.status, (await r.text()).slice(0, 300)); return false; }
    return true;
  } catch (e) { console.error('mail failed', e && e.message); return false; }
}
