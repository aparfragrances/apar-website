// Backup path: Razorpay calls this when an order is paid, so orders are saved even if the
// customer closes the browser right after paying. Set RAZORPAY_WEBHOOK_SECRET in Netlify and
// add this URL in Razorpay Dashboard → Settings → Webhooks with the "order.paid" event.
const C = require('../lib/core');

exports.handler = async event => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return C.respond(503, { error: 'Webhook secret not configured' });
  const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
  const sig = event.headers['x-razorpay-signature'] || event.headers['X-Razorpay-Signature'];
  if (!C.safeEqual(C.hmac(secret, raw), sig)) return C.respond(400, { error: 'Bad signature' });
  let ev; try { ev = JSON.parse(raw); } catch (e) { return C.respond(400, { error: 'Bad JSON' }); }
  try {
    if (ev.event === 'order.paid') {
      const ord = ev.payload.order.entity, pay = ev.payload.payment.entity;
      const pending = ord.notes && ord.notes.pending;
      if (pending) { const res = await C.finalizePaid(pending, pay.id, ord.id); if (res && res.__created) { const { __created, ...o } = res; await C.notifyNewOrder(o); } }
    }
    return C.respond(200, { ok: true });
  } catch (e) {
    if (e.status === 404) return C.respond(200, { ok: true, note: 'already handled' });
    console.error(e);
    return C.respond(500, { error: 'failed' });
  }
};
