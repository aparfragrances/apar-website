// Starts checkout. COD orders are created immediately; online orders get a Razorpay order first.
import * as C from '../../cf/lib/core.js';

export const onRequest = C.handler(async ({ request, env, waitUntil }) => {
  const b = await C.body(request);
  const user = await C.getUser(request);
  const addr = C.validateAddress(b.address);
  const pay = ['upi', 'card', 'nb', 'cod'].includes(b.pay) ? b.pay : 'upi';
  const assets = p => env.ASSETS.fetch(new URL(p, request.url));

  if (pay === 'cod') {
    const order = await C.db().runTransaction(async tx => {
      const cat = await C.readCatalog(tx);
      const T = C.priceCart(cat, b.items, b.coupon, addr.pin);
      if (!T.codOk) throw C.httpErr(400, 'Cash on Delivery is not available for this PIN code or order value. Please pay online.');
      const { id, ref } = await C.newOrderRef(tx);
      const o = C.buildOrder({ id, user, addr, T, pay, payStatus: 'COD pending' });
      C.applyStock(tx, cat, T.items, id, -1);
      C.couponUse(tx, cat, T.coupon);
      tx.set(ref, { ...o, createdAt: C.FieldValue().serverTimestamp() });
      return o;
    });
    waitUntil(C.notifyNewOrder(order, assets));
    return { mode: 'cod', order };
  }

  const { key, secret } = C.rzpKeys();
  const cat = await C.readCatalog();
  const T = C.priceCart(cat, b.items, b.coupon, addr.pin);
  const pref = C.db().collection('pending_orders').doc();
  const r = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(unescape(encodeURIComponent(key + ':' + secret))), 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: Math.round(T.total * 100), currency: 'INR', receipt: pref.id, notes: { pending: pref.id, phone: addr.phone } })
  });
  const ro = await r.json().catch(() => ({}));
  if (!r.ok || !ro.id) {
    console.error('Razorpay order error', r.status, JSON.stringify(ro));
    const e = C.httpErr(424, 'Could not start the payment. Please try again or choose Cash on Delivery.');
    if (env.APAR_DEBUG === '1' && request.headers.get('x-apar-debug') === '1') e.message += ' [Razorpay ' + r.status + ': ' + String((ro.error && ro.error.description) || '').slice(0, 120) + ' | key ' + key + ' len ' + key.length + ', secret len ' + secret.length + ']';
    throw e;
  }
  await pref.set({
    uid: user ? user.uid : null, email: (user && user.email) || addr.email || '', addr, pay,
    items: T.items, sub: T.sub, disc: T.disc, ship: T.ship, total: T.total, coupon: T.coupon,
    rzpOrderId: ro.id, ts: Date.now(), createdAt: C.FieldValue().serverTimestamp()
  });
  const method = { upi: 'upi', card: 'card', nb: 'netbanking' }[pay];
  return { mode: 'online', pendingId: pref.id,
    rzp: { key, order_id: ro.id, amount: ro.amount, currency: 'INR', prefill: { name: addr.name, email: addr.email || (user && user.email) || '', contact: '+91' + addr.phone, method } } };
}, ['POST']);
