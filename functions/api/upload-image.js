// Admin-only: stores a product photo (already resized in the browser) and returns its URL.
// Photos are kept in the Firebase database (collection "media"), served at /media/<id>.
import * as C from '../../cf/lib/core.js';
import { FieldValue } from '../../cf/lib/fs.js';

export const onRequest = C.handler(async ({ request }) => {
  const user = await C.getUser(request);
  if (!C.canAdmin(await C.roleOf(user))) throw C.httpErr(403, 'Only the store admin can upload photos.');
  const b = await C.body(request);
  const m = /^data:(image\/(webp|jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(String(b.data || ''));
  if (!m) throw C.httpErr(400, 'Please upload a JPG, PNG or WebP image.');
  const size = Math.floor(m[3].length * 3 / 4);
  if (size > 900 * 1024) throw C.httpErr(400, 'This photo is too large. Please use a smaller photo (under 900 KB after resizing).');
  const ext = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' }[m[1]];
  const rnd = Array.from(crypto.getRandomValues(new Uint8Array(4)), x => x.toString(16).padStart(2, '0')).join('');
  const id = Date.now().toString(36) + rnd + '.' + ext;
  await C.db().collection('media').doc(id).set({ type: m[1], data: FieldValue.bytes(m[3]), size, ts: Date.now() });
  return { url: '/media/' + id };
}, ['POST']);
