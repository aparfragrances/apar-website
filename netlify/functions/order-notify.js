// Staff-only: email the customer about an order update (shipped, delivered, cancelled, refund).
const C = require('../lib/core');

const TEXT = {
  shipped: ['Your order is on its way', 'Good news! Your APAR order has been shipped. You can track it using the details below.'],
  out: ['Out for delivery today', 'Your APAR order is out for delivery and should reach you today.'],
  delivered: ['Your order has been delivered', 'Your APAR order has been delivered. We hope you enjoy it! Reply to this email if anything is not right.'],
  cancelled: ['Your order has been cancelled', 'Your APAR order has been cancelled. If you paid online, the refund will reach your original payment method in 5–7 working days.'],
  refunded: ['Your refund has been processed', 'Your refund has been processed to your original payment method. It may take 5–7 working days to show in your account.']
};

exports.handler = C.handler(async event => {
  if (event.httpMethod !== 'POST') throw C.httpErr(405, 'Method not allowed');
  const user = await C.getUser(event);
  if (!C.canStaff(await C.roleOf(user))) throw C.httpErr(403, 'Only store staff can send order updates.');
  const b = C.body(event);
  const t = TEXT[b.kind];
  if (!t) throw C.httpErr(400, 'Unknown update type.');
  if (!process.env.SMTP_HOST) return { sent: false, reason: 'Email is not set up yet (add SMTP settings in Netlify).' };
  const snap = await C.db().collection('orders').doc(C.clean(b.id, 12).toUpperCase()).get();
  if (!snap.exists) throw C.httpErr(404, 'Order not found.');
  const o = snap.data();
  if (!o.email) return { sent: false, reason: 'This customer did not give an email address. Use WhatsApp instead.' };
  const cat = await C.db().doc('settings/catalog').get();
  const site = (cat.exists && cat.data().site) || {};
  const sent = await C.sendMail(o.email, `${t[0]} · APAR order ${o.id}`, C.orderEmailHtml(o, t[0], t[1], site));
  return { sent, reason: sent ? '' : 'The email could not be sent. Check the SMTP settings.' };
});
