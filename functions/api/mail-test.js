// TEMPORARY: sends one test email to the store owner only. Remove after checking.
import * as C from '../../cf/lib/core.js';
import { sendMail, mailReady } from '../../cf/lib/mail.js';

export const onRequest = C.handler(async ({ env }) => {
  if (!mailReady(env)) return { ok: false, why: 'no mail key' };
  const ok = await sendMail(env, 'aparfragrances@gmail.com', 'APAR test email: order emails are working',
    '<div style="font-family:Arial,sans-serif;color:#0f3b2e"><h2>Namaste from APAR</h2><p>This is a test. Order confirmation emails with the PDF invoice will now be sent from <b>orders@aparfragrances.com</b>.</p></div>');
  return { ok, from: env.MAIL_FROM || '(default)' };
}, ['POST']);
