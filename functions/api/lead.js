// B2B / distributor / gifting enquiries from the website form.
import * as C from '../../cf/lib/core.js';

export const onRequest = C.handler(async ({ request }) => {
  const b = await C.body(request);
  const f = {};
  ['type', 'name', 'company', 'gstin', 'phone', 'email', 'product', 'quantity', 'location'].forEach(k => { f[k] = C.clean(b[k], 120); });
  f.message = C.clean(b.message, 1500);
  if (!f.name || !f.phone || !f.location) throw C.httpErr(400, 'Please fill in your name, phone and location.');
  if (!/^[+\d][\d\s-]{7,16}$/.test(f.phone)) throw C.httpErr(400, 'Please enter a valid phone number.');
  await C.db().collection('leads').add({ ...f, date: C.today(), status: 'New', follow: '', owner: '', ts: Date.now() });
  return { ok: true };
}, ['POST']);
