// Backup path: Razorpay calls this when an order is paid, so orders are saved even if the customer
// closes the browser right after paying. Razorpay → Webhooks → URL https://aparfragrances.com/api/razorpay-webhook, event order.paid.
import * as C from '../../cf/lib/core.js';

export async function onRequest({ request, env, waitUntil }) {
  C.init(env);
  const secret = env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return C.respond(503, { error: 'Webhook secret not configured' });
  const raw = await request.text();
  const sig = request.headers.get('x-razorpay-signature');
  if (!C.safeEqual(await C.hmac(String(secret).normalize('NFKC').replace(/[^\x21-\x7e]/g, ''), raw), sig)) return C.respond(400, { error: 'Bad signature' });
  let ev; try { ev = JSON.parse(raw); } catch (e) { return C.respond(400, { error: 'Bad JSON' }); }
  try {
    if (ev.event === 'order.paid') {
      const ord = ev.payload.order.entity, pay = ev.payload.payment.entity;
      const pending = ord.notes && ord.notes.pending;
      if (pending) {
        const res = await C.finalizePaid(pending, pay.id, ord.id);
        if (res && res.__created) { const { __created, ...o } = res; waitUntil(C.notifyNewOrder(o, p => env.ASSETS.fetch(new URL(p, request.url)))); }
      }
    }
    return C.respond(200, { ok: true });
  } catch (e) {
    if (e.status === 404) return C.respond(200, { ok: true, note: 'already handled' });
    console.error(e && (e.stack || e.message));
    return C.respond(500, { error: 'failed' });
  }
}
