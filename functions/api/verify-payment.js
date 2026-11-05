// Called by the browser after Razorpay reports success. Verifies the signature, then creates the order.
import * as C from '../../cf/lib/core.js';

export const onRequest = C.handler(async ({ request, env, waitUntil }) => {
  const b = await C.body(request);
  const { secret } = C.rzpKeys();
  const ok = C.safeEqual(await C.hmac(secret, b.razorpay_order_id + '|' + b.razorpay_payment_id), b.razorpay_signature);
  if (!ok) throw C.httpErr(400, 'Payment could not be verified. If money was deducted, contact us on WhatsApp with payment ID ' + (b.razorpay_payment_id || ''));
  const res = await C.finalizePaid(b.pendingId, b.razorpay_payment_id, b.razorpay_order_id);
  const { __created, ...order } = res;
  if (__created) waitUntil(C.notifyNewOrder(order, p => env.ASSETS.fetch(new URL(p, request.url))));
  return { order };
}, ['POST']);
