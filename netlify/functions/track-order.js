// Public order tracking by order ID (shows status only, never the address or phone).
const C = require('../lib/core');

exports.handler = C.handler(async event => {
  const id = C.clean((event.queryStringParameters || {}).id, 12).toUpperCase();
  if (!/^APR\d{6}$/.test(id)) throw C.httpErr(404, 'Order not found.');
  const snap = await C.db().collection('orders').doc(id).get();
  if (!snap.exists) throw C.httpErr(404, 'Order not found.');
  const o = snap.data();
  return { order: {
    id: o.id, date: o.date, si: o.si, total: o.total, pay: o.pay, payStatus: o.payStatus, city: o.city, pin: o.pin,
    items: (o.items || []).map(i => ({ name: i.name, size: i.size, qty: i.qty, price: i.price, sku: i.sku })),
    courier: o.courier || '', tracking: o.tracking || '', refund: o.refund || '', ret: o.ret || '',
    events: (o.events || []).map(e => ({ t: e.t, msg: e.msg, ch: e.ch }))
  } };
});
