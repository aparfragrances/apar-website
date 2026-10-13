// Starts checkout. COD orders are created immediately; online orders get a Razorpay order first.
const C = require('../lib/core');

exports.handler = C.handler(async event => {
  if (event.httpMethod !== 'POST') throw C.httpErr(405, 'Method not allowed');
  const b = C.body(event);
  const user = await C.getUser(event);
  const addr = C.validateAddress(b.address);
  const pay = ['upi', 'card', 'nb', 'cod'].includes(b.pay) ? b.pay : 'upi';

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
    return { mode: 'cod', order };
  }

  const { key, secret } = C.rzpKeys();
  const cat = await C.readCatalog();
  const T = C.priceCart(cat, b.items, b.coupon, addr.pin);
  const pref = C.db().collection('pending_orders').doc();
  const r = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(key + ':' + secret).toString('base64'), 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: Math.round(T.total * 100), currency: 'INR', receipt: pref.id, notes: { pending: pref.id, phone: addr.phone } })
  });
  const ro = await r.json().catch(() => ({}));
  if (!r.ok || !ro.id) {
    console.error('Razorpay order error', r.status, ro);
    throw C.httpErr(502, 'Could not start the payment. Please try again or choose Cash on Delivery.');
  }
  await pref.set({
    uid: user ? user.uid : null, email: (user && user.email) || addr.email || '', addr, pay,
    items: T.items, sub: T.sub, disc: T.disc, ship: T.ship, total: T.total, coupon: T.coupon,
    rzpOrderId: ro.id, ts: Date.now(), createdAt: C.FieldValue().serverTimestamp()
  });
  const method = { upi: 'upi', card: 'card', nb: 'netbanking' }[pay];
  return {
    mode: 'online', pendingId: pref.id,
    rzp: { key, order_id: ro.id, amount: ro.amount, currency: 'INR', prefill: { name: addr.name, email: addr.email || (user && user.email) || '', contact: '+91' + addr.phone, method } }
  };
});
