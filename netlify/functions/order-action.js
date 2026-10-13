// Customer actions on their own order: cancel (before shipping) or request a return (after delivery).
const C = require('../lib/core');

exports.handler = C.handler(async event => {
  if (event.httpMethod !== 'POST') throw C.httpErr(405, 'Method not allowed');
  const b = C.body(event);
  const user = await C.getUser(event);
  if (!user) throw C.httpErr(401, 'Please sign in to manage your order.');
  const id = C.clean(b.id, 12).toUpperCase();
  const order = await C.db().runTransaction(async tx => {
    const ref = C.db().collection('orders').doc(id);
    const snap = await tx.get(ref);
    if (!snap.exists) throw C.httpErr(404, 'Order not found.');
    const o = snap.data();
    if (o.uid !== user.uid && !C.isAdmin(user)) throw C.httpErr(403, 'This order belongs to a different account.');
    const ev = msg => [...(o.events || []), { t: C.stamp(), msg, ch: 'Website' }];
    if (b.action === 'cancel') {
      if (o.si >= 2) throw C.httpErr(400, 'This order has already shipped and can no longer be cancelled. You can request a return after delivery.');
      if (o.si === 5) return o;
      const cat = await C.readCatalog(tx);
      const paid = o.payStatus === 'Paid';
      const upd = { si: 5, refund: paid ? 'Processing' : '', events: ev('Order cancelled by customer' + (paid ? ', refund initiated' : '')) };
      C.applyStock(tx, cat, o.items, o.id, +1);
      tx.update(ref, upd);
      return { ...o, ...upd };
    }
    if (b.action === 'return') {
      if (o.si !== 4) throw C.httpErr(400, 'Returns can be requested after the order is delivered.');
      if (o.ret) return o;
      const upd = { ret: 'Requested', events: ev('Return requested by customer') };
      tx.update(ref, upd);
      return { ...o, ...upd };
    }
    throw C.httpErr(400, 'Unknown action.');
  });
  return { order };
});
