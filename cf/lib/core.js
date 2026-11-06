// Shared server logic for APAR on Cloudflare Pages Functions.
// Prices, stock and coupons are ALWAYS recalculated here, never trusted from the browser.
import D from '../../public/assets/js/apar-data.js';
import { firestore, verifyIdToken, FieldValue as FV } from './fs.js';
import { sendMail as send, mailReady } from './mail.js';

export { D };
let ENV = {}, DB = null;
export function init(env) { if (env !== ENV) { ENV = env || {}; DB = null; } }
export const env = () => ENV;
export function httpErr(status, message) { const e = new Error(message); e.status = status; return e; }
export const db = () => DB || (DB = firestore(ENV));
export const FieldValue = () => FV;

const adminEmails = () => (ENV.ADMIN_EMAILS || 'aparfragrances@gmail.com').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

export async function getUser(request) {
  const m = /^Bearer (.+)$/.exec(request.headers.get('authorization') || '');
  if (!m) return null;
  try { return await verifyIdToken(m[1], db().projectId, ENV); } catch (e) { return null; }
}
export const isAdmin = u => !!u && u.email_verified === true && adminEmails().includes(String(u.email || '').toLowerCase());
export async function roleOf(u) {
  if (!u || u.email_verified !== true) return null;
  if (isAdmin(u)) return 'owner';
  try {
    const email = String(u.email || '').toLowerCase();
    const s = await db().collection('roles').doc(email).get();
    let r = s.exists ? s.data().role : null;
    if (!r) {
      const cleanE = x => String(x || '').normalize('NFKC').replace(/[^\x21-\x7e]/g, '').toLowerCase();
      const all = await db().collection('roles').get();
      const hit = all.docs.find(d => d.id !== email && cleanE(d.id) === cleanE(email));
      if (hit) { r = hit.data().role; await db().collection('roles').doc(email).set(Object.assign({}, hit.data(), { repairedFrom: hit.id })); await hit.ref.delete(); }
    }
    return r === 'admin' || r === 'staff' ? r : null;
  } catch (e) { return null; }
}
export const canAdmin = r => r === 'owner' || r === 'admin';
export const canStaff = r => r === 'owner' || r === 'admin' || r === 'staff';
export const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
export function couponOk(k, sub) {
  if (!k || !k.active) return false;
  if (k.expires && todayISO() > String(k.expires)) return false;
  if (k.maxUses && (k.uses || 0) >= Number(k.maxUses)) return false;
  return sub >= (k.min || 0);
}
const IST = { timeZone: 'Asia/Kolkata' };
export const today = () => new Date().toLocaleDateString('en-IN', { ...IST, day: 'numeric', month: 'short', year: 'numeric' });
export const stamp = () => new Date().toLocaleString('en-IN', { ...IST, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function vars(px, p) {
  return p.v.map(([size, g, mrp, price, stock, sku], i) => {
    const o = px[p.id + ':' + i] || {};
    return { i, size, g, sku, mrp: o.mrp ?? mrp, price: o.price ?? price, stock: o.stock ?? stock };
  });
}
export function fromDb(p) {
  return { ...p, v: (p.v || []).map(x => Array.isArray(x) ? x : [x.size, Number(x.g) || 0, Number(x.mrp) || 0, Number(x.price) || 0, Number(x.stock) || 0, x.sku || '']) };
}
export async function readCatalog(tx) {
  const ref = db().doc('settings/catalog');
  const snap = tx ? await tx.get(ref) : await ref.get();
  const d = snap.exists ? snap.data() : {};
  const products = Array.isArray(d.products) && d.products.length ? d.products.map(fromDb) : D.PRODUCTS;
  const sh = d.shipping || {};
  const shipping = Object.assign({}, D.SHIP_DEFAULT, sh, { zones: Object.assign({}, D.SHIP_DEFAULT.zones, sh.zones || {}), cod: Object.assign({}, D.SHIP_DEFAULT.cod, sh.cod || {}) });
  return { ref, px: d.px || {}, coupons: Array.isArray(d.coupons) ? d.coupons : D.COUPONS, products, shipping, site: d.site || {}, raw: d };
}
export const clean = (v, max) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, max);

export function validateAddress(a) {
  a = a || {};
  const out = {
    name: clean(a.name, 80), phone: clean(a.phone, 20).replace(/[\s-]/g, '').replace(/^(\+?91)(?=\d{10}$)/, ''),
    email: clean(a.email, 120), address: clean(a.address, 240), city: clean(a.city, 60), pin: clean(a.pin, 6)
  };
  if (!out.name) throw httpErr(400, 'Please enter your full name.');
  if (!/^[6-9]\d{9}$/.test(out.phone)) throw httpErr(400, 'Please enter a valid 10-digit mobile number.');
  if (out.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(out.email)) throw httpErr(400, 'Please enter a valid email address.');
  if (!out.address || !out.city) throw httpErr(400, 'Please enter your full delivery address.');
  if (!D.zone(out.pin)) throw httpErr(400, 'Please enter a valid 6-digit PIN code.');
  return out;
}

export function priceCart(cat, items, couponCode, pin, opts) {
  opts = opts || {};
  if (!Array.isArray(items) || !items.length || items.length > 30) throw httpErr(400, 'Your cart is empty.');
  const need = {};
  const lines = items.map(it => {
    const p = cat.products.find(x => x.id === it.pid);
    const vi = Number(it.vi), qty = Math.floor(Number(it.qty));
    if (!p || !Number.isInteger(vi) || !(qty >= 1 && qty <= 50)) throw httpErr(400, 'Your cart has an invalid item. Please refresh and try again.');
    if (p.hidden) throw httpErr(409, p.name + ' is no longer available. Please remove it from your cart.');
    const v = vars(cat.px, p)[vi];
    if (!v) throw httpErr(400, 'Your cart has an invalid pack size. Please refresh and try again.');
    need[p.id + ':' + vi] = (need[p.id + ':' + vi] || 0) + qty;
    return { p, v, qty };
  });
  if (!opts.ignoreStock) for (const l of lines) if (l.v.stock < need[l.p.id + ':' + l.v.i]) throw httpErr(409, `${l.p.name} (${l.v.size}): only ${Math.max(0, l.v.stock)} left. Please update your cart.`);
  const sub = lines.reduce((a, l) => a + l.v.price * l.qty, 0);
  const code = String(couponCode || '').trim().toUpperCase();
  const k = code && cat.coupons.find(x => x.code === code && couponOk(x, 0));
  let disc = 0;
  if (k && sub >= (k.min || 0)) disc = k.type === 'pct' ? Math.round(sub * k.value / 100) : Math.min(k.value, sub);
  const sh = cat.shipping || D.SHIP_DEFAULT;
  const z = D.quote(pin, sh);
  if (!z) throw httpErr(400, 'Please enter a valid 6-digit PIN code.');
  const free = Number(sh.free != null ? sh.free : 499), codMax = Number(sh.codMax != null ? sh.codMax : 5000);
  const after = sub - disc, ship = after >= free ? 0 : z.ship, total = after + ship;
  return { lines, sub, disc, ship, total, z, coupon: disc ? code : '', codOk: z.cod && total <= codMax,
    items: lines.map(({ p, v, qty }) => ({ pid: p.id, vi: v.i, sku: v.sku, name: p.name, size: v.size, qty, price: v.price })) };
}

const randInt = (lo, hi) => lo + (crypto.getRandomValues(new Uint32Array(1))[0] % (hi - lo));
export async function newOrderRef(tx) {
  for (let n = 0; n < 6; n++) {
    const id = 'APR' + randInt(100000, 1000000);
    const ref = db().collection('orders').doc(id);
    const snap = await tx.get(ref);
    if (!snap.exists) return { id, ref };
  }
  throw httpErr(500, 'Could not create an order number. Please try again.');
}
export function applyStock(tx, cat, items, orderId, sign) {
  const ch = {};
  items.forEach(it => {
    const p = cat.products.find(x => x.id === it.pid);
    if (!p) return;
    const vi = Number.isInteger(it.vi) ? it.vi : p.v.findIndex(x => x[0] === it.size);
    if (vi < 0) return;
    const key = p.id + ':' + vi;
    const cur = ch[key] ? ch[key].stock : vars(cat.px, p)[vi].stock;
    ch[key] = { stock: Math.max(0, cur + sign * it.qty) };
    tx.set(db().collection('inventory_log').doc(), { date: stamp(), sku: it.sku, type: sign < 0 ? 'Stock out' : 'Stock in', qty: it.qty, note: (sign < 0 ? 'Sale ' : 'Cancelled ') + orderId, ts: Date.now() });
  });
  if (Object.keys(ch).length) tx.set(cat.ref, { px: ch }, { merge: true });
}
export function couponUse(tx, cat, code) {
  if (!code) return;
  tx.set(cat.ref, { coupons: cat.coupons.map(k => k.code === code ? { ...k, uses: (k.uses || 0) + 1 } : k) }, { merge: true });
}
export function buildOrder({ id, user, addr, T, pay, payStatus, txn, note }) {
  const payName = { upi: 'UPI', card: 'Card', nb: 'Net Banking', cod: 'COD', online: 'Online' }[pay] || 'Online';
  return {
    id, date: today(), ts: Date.now(), uid: user ? user.uid : null, user: (user && user.email) || addr.phone,
    name: addr.name, phone: addr.phone, email: addr.email || (user && user.email) || '', address: addr.address, city: addr.city, pin: addr.pin,
    items: T.items.map(({ pid, vi, sku, name, size, qty, price }) => ({ pid, vi, sku, name, size, qty, price })),
    sub: T.sub, disc: T.disc, ship: T.ship, total: T.total, coupon: T.coupon || '',
    pay: pay === 'cod' ? 'COD' : 'Online · ' + payName, payStatus, txn: txn || '',
    si: 0, tracking: '', courier: '', refund: '', ret: '', note: note || '',
    events: [{ t: stamp(), msg: 'Order placed · ' + id + (payStatus === 'Paid' ? ' · payment received' : ''), ch: 'Website' }]
  };
}

export function rzpKeys() {
  // Also accept the names from Razorpay's downloaded key file (key_id / key_secret).
  const key = ENV.RAZORPAY_KEY_ID || ENV.key_id, secret = ENV.RAZORPAY_KEY_SECRET || ENV.key_secret;
  if (!key || !secret) throw httpErr(503, 'Online payment is being set up. Please choose Cash on Delivery for now.');
  const tidy = v => String(v).normalize('NFKC').replace(/[^\x21-\x7e]/g, '');
  // People often paste the label too ("Key ID: rzp_live_…"). Keep only the actual key.
  const k = tidy(key), m = /rzp_(live|test)_[A-Za-z0-9]+/.exec(k);
  let sec = tidy(secret).replace(/^.*[:=]/, '');
  const runs = sec.match(/[A-Za-z0-9]{16,}/g);
  if (sec.length > 30 && runs) sec = runs[runs.length - 1];
  return { key: m ? m[0] : k, secret: sec };
}
export async function hmac(secret, body) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const s = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(body)));
  return Array.from(s, b => b.toString(16).padStart(2, '0')).join('');
}
export function safeEqual(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length || !a.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function finalizePaid(pendingId, paymentId, rzpOrderId) {
  return db().runTransaction(async tx => {
    const pref = db().collection('pending_orders').doc(String(pendingId));
    const pend = await tx.get(pref);
    const dupQ = await tx.get(db().collection('orders').where('txn', '==', String(paymentId)).limit(1));
    if (!dupQ.empty) return dupQ.docs[0].data();
    if (!pend.exists) throw httpErr(404, 'We could not find this payment session. If money was deducted, contact us on WhatsApp with your payment ID: ' + paymentId);
    const P = pend.data();
    if (rzpOrderId && P.rzpOrderId !== rzpOrderId) throw httpErr(400, 'Payment does not match this order.');
    const cat = await readCatalog(tx);
    const { id, ref } = await newOrderRef(tx);
    const T = { items: P.items, sub: P.sub, disc: P.disc, ship: P.ship, total: P.total, coupon: P.coupon };
    let note = '';
    P.items.forEach(it => { const p = cat.products.find(x => x.id === it.pid); if (p && vars(cat.px, p)[it.vi] && vars(cat.px, p)[it.vi].stock < it.qty) note = 'Stock check needed: an item sold out while this customer was paying.'; });
    const order = buildOrder({ id, user: P.uid ? { uid: P.uid, email: P.email } : null, addr: P.addr, T, pay: P.pay, payStatus: 'Paid', txn: paymentId, note });
    applyStock(tx, cat, P.items, id, -1);
    couponUse(tx, cat, P.coupon);
    tx.set(ref, { ...order, createdAt: FV.serverTimestamp() });
    tx.delete(pref);
    return Object.assign({}, order, { __created: true });
  });
}

// ---------- Email ----------
export const emailReady = () => mailReady(ENV);
export const sendMail = (to, subject, html, attachments) => send(ENV, to, subject, html, attachments);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rupee = n => '₹' + Math.round(n || 0).toLocaleString('en-IN');
export function orderEmailHtml(o, heading, intro, site) {
  site = site || {};
  const rows = (o.items || []).map(i => `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${esc(i.name)} · ${esc(i.size)} × ${i.qty}</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">${rupee(i.price * i.qty)}</td></tr>`).join('');
  const base = ENV.SITE_URL || 'https://aparfragrances.com';
  return `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1c2420">
  <div style="background:#0f3b2e;color:#f7f2e8;padding:20px 24px;font-size:22px;letter-spacing:.2em">APAR</div>
  <div style="padding:24px;background:#fbf8f1;border:1px solid #e0d3b8">
  <h2 style="margin:0 0 8px;color:#0f3b2e;font-weight:400">${esc(heading)}</h2>
  <p style="margin:0 0 16px;line-height:1.6">${intro}</p>
  <p style="margin:0 0 6px"><strong>Order ${esc(o.id)}</strong> · ${esc(o.date)}</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}
  <tr><td style="padding:6px 0">Subtotal</td><td style="text-align:right">${rupee(o.sub)}</td></tr>
  ${o.disc ? `<tr><td style="padding:6px 0">Discount</td><td style="text-align:right">−${rupee(o.disc)}</td></tr>` : ''}
  <tr><td style="padding:6px 0">Delivery</td><td style="text-align:right">${o.ship ? rupee(o.ship) : 'Free'}</td></tr>
  <tr><td style="padding:8px 0;font-weight:bold">Total</td><td style="text-align:right;font-weight:bold">${rupee(o.total)}</td></tr></table>
  <p style="margin:16px 0 0;font-size:14px;line-height:1.6">Payment: ${esc(o.pay)} · ${esc(o.payStatus)}<br>Deliver to: ${esc(o.name)}, ${esc(o.address)}, ${esc(o.city)} ${esc(o.pin)} · ${esc(o.phone)}</p>
  ${o.tracking ? `<p style="margin:12px 0 0;font-size:14px">Courier: ${esc(o.courier)} · Tracking no. <strong>${esc(o.tracking)}</strong></p>` : ''}
  <p style="margin:20px 0 0"><a href="${base}/#/track/${esc(o.id)}" style="background:#0f3b2e;color:#f7f2e8;padding:12px 20px;border-radius:30px;text-decoration:none;font-size:13px;letter-spacing:.1em">TRACK ORDER</a></p>
  </div><p style="font-size:12px;color:#888;padding:12px 24px">APAR · Jaipur · FSSAI ${esc(site.fssai || '12217026000698')}${site.gstin ? ' · GSTIN ' + esc(site.gstin) : ''}</p></div>`;
}
export async function notifyNewOrder(o, assets) {
  if (!emailReady()) return;
  let site = {}, products = D.PRODUCTS;
  try { const s = await db().doc('settings/catalog').get(); if (s.exists) { const c = s.data(); site = c.site || {}; if (Array.isArray(c.products) && c.products.length) products = c.products; } } catch (e) { }
  const owner = site.notifyEmail || ENV.NOTIFY_EMAIL || adminEmails()[0];
  let att;
  try { const { invoicePdf } = await import('./pdf.js'); const pdf = await invoicePdf(o, site, products, assets); if (pdf) att = [{ filename: 'APAR-Invoice-' + o.id + '.pdf', content: pdf, contentType: 'application/pdf' }]; } catch (e) { console.error('invoice pdf', e && e.message); }
  const jobs = [sendMail(owner, `New order ${o.id} · ${rupee(o.total)} · ${o.pay}`, orderEmailHtml(o, 'New order received', `${esc(o.name)} (${esc(o.phone)}) just placed an order. Open the admin app to pack it.`, site), att)];
  if (o.email) jobs.push(sendMail(o.email, `Your APAR order ${o.id} is confirmed`, orderEmailHtml(o, 'Thank you for your order', 'We have received your order and will pack it soon. Your tax invoice is attached to this email as a PDF. We will email you again when it ships.', site), att));
  await Promise.all(jobs);
}

// ---------- HTTP helpers ----------
export function respond(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
// Wrap a handler: (ctx) => result object. Errors with .status become friendly JSON messages.
export function handler(fn, methods) {
  return async ctx => {
    init(ctx.env);
    if (methods && !methods.includes(ctx.request.method)) return respond(405, { error: 'Method not allowed' });
    try { return respond(200, await fn(ctx)); }
    catch (e) {
      if (!e.status || e.internal) console.error(e && (e.stack || e.message));
      const show = e.status && !e.internal;
      const out = { error: show ? e.message : 'Something went wrong on our side. Please try again, or order on WhatsApp.' };
      // Diagnostic detail only when the request carries the support header (never shown to shoppers).
      if (!show && ENV.APAR_DEBUG === '1' && ctx.request.headers.get('x-apar-debug') === '1') out.detail = String((e && e.name) || '') + ': ' + String((e && e.message) || '').replace(/rzp_[a-z]+_[A-Za-z0-9]+/g, 'rzp_***').slice(0, 300);
      return respond(show ? e.status : 500, out);
    }
  };
}
export async function body(request) {
  try { return JSON.parse((await request.text()) || '{}'); } catch (e) { throw httpErr(400, 'Invalid request.'); }
}
