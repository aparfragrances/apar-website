// Shared server-side logic for APAR Netlify functions.
// Prices, stock and coupons are ALWAYS recalculated here, never trusted from the browser.
const crypto = require('crypto');
const D = require('../../public/assets/js/apar-data.js');

let adminSdk = null;
function httpErr(status, message) { const e = new Error(message); e.status = status; return e; }

function admin() {
  if (adminSdk) return adminSdk;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw httpErr(503, 'The store is still being set up (database key missing). Please try again later or order on WhatsApp.');
  let sa;
  try { sa = JSON.parse(raw); } catch (e) { throw httpErr(503, 'Server configuration error (FIREBASE_SERVICE_ACCOUNT is not valid JSON).'); }
  if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  const a = require('firebase-admin');
  if (!a.apps.length) a.initializeApp({ credential: a.credential.cert(sa) });
  adminSdk = a;
  return a;
}
const db = () => admin().firestore();
const FieldValue = () => admin().firestore.FieldValue;

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'aparfragrances@gmail.com').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

async function getUser(event) {
  const h = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
  const m = /^Bearer (.+)$/.exec(h);
  if (!m) return null;
  try { return await admin().auth().verifyIdToken(m[1]); } catch (e) { return null; }
}
const isAdmin = u => !!u && u.email_verified === true && ADMIN_EMAILS.includes(String(u.email || '').toLowerCase());
// Roles: the owner email(s) above are always admin. Extra people are added in the admin app (roles/{email} = { role: 'admin' | 'staff' }).
async function roleOf(u) {
  if (!u || u.email_verified !== true) return null;
  if (isAdmin(u)) return 'owner';
  try {
    const s = await db().collection('roles').doc(String(u.email || '').toLowerCase()).get();
    const r = s.exists ? s.data().role : null;
    return r === 'admin' || r === 'staff' ? r : null;
  } catch (e) { return null; }
}
const canAdmin = r => r === 'owner' || r === 'admin';
const canStaff = r => r === 'owner' || r === 'admin' || r === 'staff';
const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
// A coupon works if it is active, not expired and not used up.
function couponOk(k, sub) {
  if (!k || !k.active) return false;
  if (k.expires && todayISO() > String(k.expires)) return false;
  if (k.maxUses && (k.uses || 0) >= Number(k.maxUses)) return false;
  return sub >= (k.min || 0);
}

const IST = { timeZone: 'Asia/Kolkata' };
const today = () => new Date().toLocaleDateString('en-IN', { ...IST, day: 'numeric', month: 'short', year: 'numeric' });
const stamp = () => new Date().toLocaleString('en-IN', { ...IST, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function vars(px, p) {
  return p.v.map(([size, g, mrp, price, stock, sku], i) => {
    const o = px[p.id + ':' + i] || {};
    return { i, size, g, sku, mrp: o.mrp ?? mrp, price: o.price ?? price, stock: o.stock ?? stock };
  });
}

// Products saved by the admin panel live in settings/catalog.products (variants stored as objects).
function fromDb(p) {
  return { ...p, v: (p.v || []).map(x => Array.isArray(x) ? x : [x.size, Number(x.g) || 0, Number(x.mrp) || 0, Number(x.price) || 0, Number(x.stock) || 0, x.sku || '']) };
}
async function readCatalog(tx) {
  const ref = db().doc('settings/catalog');
  const snap = tx ? await tx.get(ref) : await ref.get();
  const d = snap.exists ? snap.data() : {};
  const products = Array.isArray(d.products) && d.products.length ? d.products.map(fromDb) : D.PRODUCTS;
  const sh = d.shipping || {};
  const shipping = Object.assign({}, D.SHIP_DEFAULT, sh, { zones: Object.assign({}, D.SHIP_DEFAULT.zones, sh.zones || {}), cod: Object.assign({}, D.SHIP_DEFAULT.cod, sh.cod || {}) });
  return { ref, px: d.px || {}, coupons: Array.isArray(d.coupons) ? d.coupons : D.COUPONS, products, shipping };
}

const clean = (v, max) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, max);

function validateAddress(a) {
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

// Recalculate the whole cart from the catalog. Throws on invalid items or not enough stock.
function priceCart(cat, items, couponCode, pin, opts) {
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
  if (!opts.ignoreStock) {
    for (const l of lines) {
      if (l.v.stock < need[l.p.id + ':' + l.v.i]) throw httpErr(409, `${l.p.name} (${l.v.size}): only ${Math.max(0, l.v.stock)} left. Please update your cart.`);
    }
  }
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
  return {
    lines, sub, disc, ship, total, z, coupon: disc ? code : '', codOk: z.cod && total <= codMax,
    items: lines.map(({ p, v, qty }) => ({ pid: p.id, vi: v.i, sku: v.sku, name: p.name, size: v.size, qty, price: v.price }))
  };
}

// Inside a transaction: create a unique order ID.
async function newOrderRef(tx) {
  for (let n = 0; n < 6; n++) {
    const id = 'APR' + crypto.randomInt(100000, 1000000);
    const ref = db().collection('orders').doc(id);
    const snap = await tx.get(ref);
    if (!snap.exists) return { id, ref };
  }
  throw httpErr(500, 'Could not create an order number. Please try again.');
}

// Inside a transaction (after all reads): reduce stock and log it.
function applyStock(tx, cat, items, orderId, sign) {
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

function couponUse(tx, cat, code) {
  if (!code) return;
  tx.set(cat.ref, { coupons: cat.coupons.map(k => k.code === code ? { ...k, uses: (k.uses || 0) + 1 } : k) }, { merge: true });
}

function buildOrder({ id, user, addr, T, pay, payStatus, txn, note }) {
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

function rzpKeys() {
  const key = process.env.RAZORPAY_KEY_ID, secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key || !secret) throw httpErr(503, 'Online payment is being set up. Please choose Cash on Delivery for now.');
  return { key, secret };
}
function hmac(secret, body) { return crypto.createHmac('sha256', secret).update(body).digest('hex'); }
function safeEqual(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Turn a paid Razorpay order (pending order) into a real order. Safe to call twice.
async function finalizePaid(pendingId, paymentId, rzpOrderId) {
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
    // Use the prices the customer actually paid (stored when the payment started).
    const T = { items: P.items, sub: P.sub, disc: P.disc, ship: P.ship, total: P.total, coupon: P.coupon };
    let note = '';
    P.items.forEach(it => {
      const p = cat.products.find(x => x.id === it.pid);
      if (p && vars(cat.px, p)[it.vi] && vars(cat.px, p)[it.vi].stock < it.qty) note = 'Stock check needed: an item sold out while this customer was paying.';
    });
    const order = buildOrder({ id, user: P.uid ? { uid: P.uid, email: P.email } : null, addr: P.addr, T, pay: P.pay, payStatus: 'Paid', txn: paymentId, note });
    applyStock(tx, cat, P.items, id, -1);
    couponUse(tx, cat, P.coupon);
    tx.set(ref, { ...order, createdAt: FieldValue().serverTimestamp() });
    tx.delete(pref);
    return Object.assign({}, order, { __created: true });
  });
}


// ---------- Email (optional): set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (e.g. your Zoho mailbox) in Netlify ----------
let transport = null;
function mailer() {
  if (transport !== null) return transport;
  const host = process.env.SMTP_HOST, user = process.env.SMTP_USER, pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) { transport = false; return false; }
  const port = Number(process.env.SMTP_PORT || 465);
  transport = require('nodemailer').createTransport({ host, port, secure: port === 465, auth: { user, pass } });
  return transport;
}
async function sendMail(to, subject, html) {
  const t = mailer();
  if (!t || !to) return false;
  const from = process.env.MAIL_FROM || ('APAR <' + process.env.SMTP_USER + '>');
  try {
    await Promise.race([t.sendMail({ from, to, subject, html }), new Promise((_, rej) => setTimeout(() => rej(new Error('mail timeout')), 5000))]);
    return true;
  } catch (e) { console.error('mail failed', e.message); return false; }
}
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rupee = n => '₹' + Math.round(n || 0).toLocaleString('en-IN');
function orderEmailHtml(o, heading, intro, site) {
  site = site || {};
  const rows = (o.items || []).map(i => `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${esc(i.name)} · ${esc(i.size)} × ${i.qty}</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">${rupee(i.price * i.qty)}</td></tr>`).join('');
  const base = process.env.SITE_URL || 'https://aparfragrances.com';
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
  </div><p style="font-size:12px;color:#888;padding:12px 24px">APAR · Jaipur${site.fssai ? ' · FSSAI ' + esc(site.fssai) : ''}${site.gstin ? ' · GSTIN ' + esc(site.gstin) : ''}</p></div>`;
}
// New order: alert the store owner and send the customer a confirmation (only when email is configured).
async function notifyNewOrder(o) {
  if (!mailer()) return;
  let site = {};
  try { const s = await db().doc('settings/catalog').get(); site = (s.exists && s.data().site) || {}; } catch (e) { }
  const owner = site.notifyEmail || process.env.NOTIFY_EMAIL || ADMIN_EMAILS[0];
  const jobs = [sendMail(owner, `New order ${o.id} · ${rupee(o.total)} · ${o.pay}`, orderEmailHtml(o, 'New order received', `${esc(o.name)} (${esc(o.phone)}) just placed an order. Open the admin app to pack it.`, site))];
  if (o.email) jobs.push(sendMail(o.email, `Your APAR order ${o.id} is confirmed`, orderEmailHtml(o, 'Thank you for your order', 'We have received your order and will pack it soon. We will email you again when it ships.', site)));
  await Promise.all(jobs);
}

function respond(status, body) {
  return { statusCode: status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}
function handler(fn) {
  return async event => {
    try {
      return respond(200, await fn(event));
    } catch (e) {
      if (!e.status) console.error(e);
      return respond(e.status || 500, { error: e.status ? e.message : 'Something went wrong on our side. Please try again, or order on WhatsApp.' });
    }
  };
}
function body(event) {
  try { return JSON.parse(event.body || '{}'); } catch (e) { throw httpErr(400, 'Invalid request.'); }
}

module.exports = { roleOf, canAdmin, canStaff, couponOk, todayISO, notifyNewOrder, sendMail, orderEmailHtml, fromDb, D, admin, db, FieldValue, httpErr, getUser, isAdmin, today, stamp, vars, readCatalog, validateAddress, priceCart, newOrderRef, applyStock, couponUse, buildOrder, rzpKeys, hmac, safeEqual, finalizePaid, respond, handler, body, clean };
