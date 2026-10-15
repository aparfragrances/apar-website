// Called by the browser after Razorpay reports success. Verifies the signature, then creates the order.
const C = require('../lib/core');

exports.handler = C.handler(async event => {
  if (event.httpMethod !== 'POST') throw C.httpErr(405, 'Method not allowed');
  const b = C.body(event);
  const { secret } = C.rzpKeys();
  const ok = C.safeEqual(C.hmac(secret, b.razorpay_order_id + '|' + b.razorpay_payment_id), b.razorpay_signature);
  if (!ok) throw C.httpErr(400, 'Payment could not be verified. If money was deducted, contact us on WhatsApp with payment ID ' + (b.razorpay_payment_id || ''));
  const res = await C.finalizePaid(b.pendingId, b.razorpay_payment_id, b.razorpay_order_id);
  const { __created, ...order } = res;
  if (__created) await C.notifyNewOrder(order);
  return { order };
});
