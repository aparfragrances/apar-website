(function () {
  const KEY = 'apar-shop-v3';
  const inr = n => '₹' + Math.round(n || 0).toLocaleString('en-IN');
  const today = () => new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const stamp = () => new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const csv = (name, rows) => { const t = rows.map(r => r.map(x => '"' + String(x ?? '').replace(/"/g, '""') + '"').join(',')).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: 'text/csv' })); a.download = name; a.click(); };
  const pill = on => ({ bd: on ? '#0f3b2e' : '#d8c7a4', bg: on ? '#0f3b2e' : 'transparent', fg: on ? '#f7f2e8' : '#1c2420' });
  const star = n => '★★★★★'.slice(0, Math.round(n)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(n));

  const S = {
    KEY, inr, today, stamp, csv, pill, star,
    defaults() {
      const D = window.APAR_DATA;
      return { cart: [], wish: [], user: null, users: [], orders: [], leads: [], reviews: {}, px: {}, coupons: D.COUPONS, hist: [], txns: [], consent: '', admin: false,
        q: '', sort: 'featured', sel: 0, qty: 1, img: 0, coupon: '', couponMsg: '', couponOk: true, pay: 'upi', simFail: false, paying: false, toast: '', rating: 5,
        authMode: 'link', authEmail: '', authMsg: '', authBusy: false, linkPending: false, trackLookup: '', trackDone: '', trackRemote: null, otpSent: false, otpPhone: '', acctTab: 'orders', adminTab: 'dashboard', pin: '', pinMsg: '', addrIdx: -1, adj: {}, adjType: {}, adminErr: '' };
    },
    persisted: ['cart', 'wish', 'consent', 'pin'],
    find: id => window.APAR_DATA.PRODUCTS.find(p => p.id === id),
    vars(c, p) { return p.v.map(([size, g, mrp, price, stock, sku], i) => { const o = c.state.px[p.id + ':' + i] || {}; return { i, size, g, sku, mrp: o.mrp ?? mrp, price: o.price ?? price, stock: o.stock ?? stock }; }); },
    catName: slug => (window.APAR_DATA.CATS.find(x => x.slug === slug) || {}).name,
    flash(c, t) { clearTimeout(c.tt); c.setState({ toast: t }); c.tt = setTimeout(() => c.setState({ toast: '' }), 2600); },
    log(c, sku, type, qty, note) { c.setState(s => ({ hist: [{ date: stamp(), sku, type, qty, note }, ...s.hist].slice(0, 200) })); },
    setStock(s, pid, i, stock) { return { ...s.px, [pid + ':' + i]: { ...(s.px[pid + ':' + i] || {}), stock: Math.max(0, stock) } }; },
    add(c, pid, vi, qty) {
      const p = S.find(pid), v = S.vars(c, p)[vi];
      if (!v || v.stock <= 0) { S.flash(c, 'This pack is out of stock'); return false; }
      c.setState(s => { const cart = s.cart.map(l => ({ ...l })); const l = cart.find(l => l.pid === pid && l.vi === vi); if (l) l.qty = Math.min(l.qty + qty, v.stock); else cart.push({ pid, vi, qty: Math.min(qty, v.stock) }); return { cart }; });
      S.flash(c, p.name + ' · ' + v.size + ' added'); return true;
    },
    toggleWish(c, pid) { c.setState(s => ({ wish: s.wish.includes(pid) ? s.wish.filter(x => x !== pid) : [...s.wish, pid] })); },
    rating(c, pid) { const r = (c.state.reviews[pid] || []).filter(x => x.approved); if (!r.length) return { avg: 0, text: 'No reviews yet', n: 0 }; const a = r.reduce((s, x) => s + x.rating, 0) / r.length; return { avg: a, text: a.toFixed(1) + ' ★ · ' + r.length + (r.length > 1 ? ' reviews' : ' review'), n: r.length }; },
    card(c, p) {
      const vs = S.vars(c, p), v = vs[0], w = c.state.wish.includes(p.id), out = vs.every(x => x.stock <= 0);
      return { name: p.name, cat: S.catName(p.cat), img: p.img, pos: p.pos || '50% 50%', href: '#/product/' + p.id, price: inr(v.price), mrp: inr(v.mrp), hasOff: v.mrp > v.price, off: Math.round((1 - v.price / v.mrp) * 100) + '% off', from: vs.length > 1 ? 'From ' : '', size: vs.length > 1 ? vs.map(x => x.size).join(' · ') : v.size, rating: S.rating(c, p.id).text, isOut: out, addLabel: out ? 'Out of stock' : 'Add to cart',
        add: () => { const i = vs.findIndex(x => x.stock > 0); if (i >= 0) S.add(c, p.id, i, 1); }, wish: () => S.toggleWish(c, p.id), wishFill: w ? '#b3202f' : 'none', wishStroke: w ? '#b3202f' : '#0f3b2e' };
    },
    couponCalc(c, code, sub) { const k = c.state.coupons.find(x => x.code === code && x.active); if (!k || sub < (k.min || 0)) return 0; return k.type === 'pct' ? Math.round(sub * k.value / 100) : Math.min(k.value, sub); },
    totals(c, pinOverride) {
      const s = c.state;
      const lines = s.cart.map((l, idx) => { const p = S.find(l.pid); if (!p) return null; const v = S.vars(c, p)[l.vi]; return v ? { p, v, l, idx } : null; }).filter(Boolean);
      const sub = lines.reduce((a, x) => a + x.v.price * x.l.qty, 0), disc = S.couponCalc(c, s.coupon, sub);
      const z = window.APAR_DATA.zone(pinOverride || s.pin), after = sub - disc;
      const ship = sub === 0 || after >= 499 ? 0 : (z ? z.ship : 49);
      const total = after + ship;
      return { lines, sub, disc, ship, total, z, codOk: (!z || z.cod) && total <= 5000 };
    },
    invoice(o) {
      const rows = o.items.map(i => `<tr><td>${i.name}<br><small>${i.sku || ''} · ${i.size}</small></td><td>${i.qty}</td><td>${inr(i.price)}</td><td>${inr(i.price * i.qty)}</td></tr>`).join('');
      const C = window.APAR_DATA.CONTACT;
      const html = `<!doctype html><meta charset="utf-8"><title>Invoice ${o.id}</title><style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;color:#1c2420}h1{color:#0f3b2e;letter-spacing:.2em}table{width:100%;border-collapse:collapse;margin-top:24px}td,th{border-bottom:1px solid #ddd;padding:10px;text-align:left}small{color:#777}.r{text-align:right}</style><h1>APAR</h1><p>${C.address}<br>${C.phone} · ${C.email}<br>GSTIN: ${(window.APAR_DATA.SITE && window.APAR_DATA.SITE.gstin) || 'To be confirmed'}</p><h2>Tax Invoice ${o.id}</h2><p>Date: ${o.date}<br>Bill to: ${o.name}, ${o.address}, ${o.city} ${o.pin}<br>Phone: ${o.phone}</p><table><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>${rows}<tr><td colspan="3" class="r">Subtotal</td><td>${inr(o.sub)}</td></tr><tr><td colspan="3" class="r">Discount</td><td>−${inr(o.disc)}</td></tr><tr><td colspan="3" class="r">Shipping</td><td>${inr(o.ship)}</td></tr><tr><th colspan="3" class="r">Total</th><th>${inr(o.total)}</th></tr></table><p>Payment: ${o.pay} · ${o.payStatus}${o.txn ? ' · ' + o.txn : ''}</p><p><small>Tax breakup will be added once GST details are confirmed.</small></p>`;
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' })); a.download = 'APAR-Invoice-' + o.id + '.html'; a.click();
    },
    notify(o, msg) { return [...(o.events || []), { t: stamp(), msg, ch: 'WhatsApp · SMS · Email' }]; },
    updateOrder(c, id, fn) { if (!c.state.admin) { window.AparCloud.orderAction(c, 'return', id); return; } c.setState(s => ({ orders: s.orders.map(o => o.id === id ? fn(o) : o) })); },
    cancel(c, o) {
      if (!c.state.admin) { window.AparCloud.orderAction(c, 'cancel', o.id); return; }
      c.setState(s => {
        let px = s.px; const hist = [...s.hist];
        o.items.forEach(it => { const p = S.find(it.pid); const i = p ? p.v.findIndex(x => x[0] === it.size) : -1; if (i >= 0) { const cur = S.vars({ state: { px } }, p)[i]; px = S.setStock({ px }, p.id, i, cur.stock + it.qty); hist.unshift({ date: stamp(), sku: it.sku, type: 'Stock in', qty: it.qty, note: 'Cancelled ' + o.id }); } });
        return { px, hist, orders: s.orders.map(x => x.id === o.id ? { ...x, si: 5, refund: x.payStatus === 'Paid' ? 'Processing' : '', events: S.notify(x, 'Order cancelled' + (x.payStatus === 'Paid' ? ', refund initiated' : '')) } : x) };
      });
      S.flash(c, 'Order ' + o.id + ' cancelled');
    },
    reorder(c, o) { o.items.forEach(it => { const p = S.find(it.pid); if (!p) return; const i = p.v.findIndex(x => x[0] === it.size); if (i >= 0) S.add(c, p.id, i, it.qty); }); location.hash = '#/cart'; },
    downloadCatalogue(c) {
      const rows = [['SKU', 'Product', 'Category', 'Pack size', 'MRP (INR)', 'Price (INR)', 'In stock']];
      window.APAR_DATA.PRODUCTS.forEach(p => S.vars(c, p).forEach(v => rows.push([v.sku, p.name, S.catName(p.cat), v.size, v.mrp, v.price, v.stock > 0 ? 'Yes' : 'No'])));
      csv('APAR-Product-Catalogue.csv', rows);
    },
    placeOrder(c, f) { return window.AparCloud.placeOrder(c, f); }
  };
  window.AparStore = S;
})();
