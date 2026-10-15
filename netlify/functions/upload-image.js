// Admin-only: stores a product photo (already resized in the browser) and returns its URL.
const C = require('../lib/core');
const { connectLambda, getStore } = require('@netlify/blobs');

exports.handler = C.handler(async event => {
  if (event.httpMethod !== 'POST') throw C.httpErr(405, 'Method not allowed');
  const user = await C.getUser(event);
  if (!C.canAdmin(await C.roleOf(user))) throw C.httpErr(403, 'Only the store admin can upload photos.');
  const b = C.body(event);
  const m = /^data:(image\/(webp|jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(String(b.data || ''));
  if (!m) throw C.httpErr(400, 'Please upload a JPG, PNG or WebP image.');
  const buf = Buffer.from(m[3], 'base64');
  if (buf.length > 4 * 1024 * 1024) throw C.httpErr(400, 'This photo is too large. Please use one under 4 MB.');
  connectLambda(event);
  const ext = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' }[m[1]];
  const id = Date.now().toString(36) + require('crypto').randomBytes(4).toString('hex') + '.' + ext;
  await getStore('product-images').set(id, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), { metadata: { type: m[1] } });
  return { url: '/media/' + id };
});
