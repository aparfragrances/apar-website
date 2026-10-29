// APAR Admin — data layer: Firebase connection, live data, actions, printing and exports.
(function () {
  const D = window.APAR_DATA;
  const OWNER_EMAILS = ['aparfragrances@gmail.com'];
  const API = '/.netlify/functions/';
  const A = (window.AA = window.AA || {});

  // ---------- small helpers ----------
  const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
  const IST = { timeZone: 'Asia/Kolkata' };
  const stamp = () => new Date().toLocaleString('en-IN', Object.assign({ day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }, IST));
  const today = () => new Date().toLocaleDateString('en-IN', Object.assign({ day: 'numeric', month: 'short', year: 'numeric' }, IST));
  const todayISO = () => new Date().toLocaleDateString('en-CA', IST);
  const dayKey = ts => new Date(ts).toLocaleDateString('en-CA', IST);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  const STATUSES = D.STATUSES; // Placed, Packed, Shipped, Out for delivery, Delivered, Cancelled
  const COURIERS = ['Delhivery', 'Shiprocket', 'Blue Dart', 'DTDC', 'Xpressbees', 'Ekart', 'India Post', 'Shadowfax', 'Self delivery', 'Other'];
  const DETAILS = [['netQty', 'Net quantity'], ['ingredients', 'Ingredients'], ['nutrition', 'Nutrition per 100 g'], ['allergens', 'Allergens'], ['storage', 'Storage'], ['shelfLife', 'Shelf life'], ['manufacturer', 'Manufacturer / packer'], ['barcode', 'Barcode / GTIN']];
  Object.assign(A, { D, inr, stamp, today, todayISO, dayKey, esc, slug, STATUSES, COURIERS, DETAILS, OWNER_EMAILS });

  // ---------- Firebase ----------
  let auth = null, db = null;
  A.init = function () {
    if (!window.firebase || !window.APAR_FIREBASE) throw new Error('Could not load Firebase. Check your internet connection and refresh.');
    if (!firebase.apps.length) firebase.initializeApp(window.APAR_FIREBASE);
    auth = firebase.auth(); db = firebase.firestore();
    A.auth = auth; A.db = db;
  };
  const FV = () => firebase.firestore.FieldValue;
  const me = () => (auth && auth.currentUser && auth.currentUser.email) || 'admin';

  async function api(name, payload, method) {
    let t = null;
    try { if (auth.currentUser) t = await auth.currentUser.getIdToken(); } catch (e) { }
    const r = await fetch(API + name, { method: method || 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, t ? { Authorization: 'Bearer ' + t } : {}), body: payload ? JSON.stringify(payload) : undefined });
    let j = {}; try { j = await r.json(); } catch (e) { }
    if (!r.ok) throw new Error(j.error || 'Server error (' + r.status + ')');
    return j;
  }
  A.api = api;

  // Who is this person? owner → admin → staff → none
  A.roleOf = async function (u) {
    if (!u) return null;
    const email = String(u.email || '').toLowerCase();
    if (!u.emailVerified) return 'unverified';
    if (OWNER_EMAILS.includes(email)) return 'owner';
    try { const s = await db.collection('roles').doc(email).get(); if (s.exists && ['admin', 'staff'].includes(s.data().role)) return s.data().role; } catch (e) { }
    // Second opinion from the server (works even if the browser read above failed or was cached).
    try { const r = await api('whoami'); if (['owner', 'admin', 'staff'].includes(r.role)) return r.role === 'owner' ? 'admin' : r.role; } catch (e) { }
    return null;
  };
  A.canAdmin = r => r === 'owner' || r === 'admin';

  // ---------- products ----------
  const fromDb = p => Object.assign({}, p, { v: (p.v || []).map(x => Array.isArray(x) ? x : [x.size, Number(x.g) || 0, Number(x.mrp) || 0, Number(x.price) || 0, Number(x.stock) || 0, x.sku || '']) });
  const toDb = p => { const o = Object.assign({}, p, { v: p.v.map(([size, g, mrp, price, stock, sku]) => ({ size, g, mrp, price, stock: stock || 0, sku: sku || '' })) }); Object.keys(o).forEach(k => o[k] === undefined && delete o[k]); return o; };
  A.vars = (px, p) => p.v.map(([size, g, mrp, price, stock, sku], i) => { const o = (px || {})[p.id + ':' + i] || {}; return { i, size, g, sku, mrp: o.mrp != null ? o.mrp : mrp, price: o.price != null ? o.price : price, stock: o.stock != null ? o.stock : stock }; });
  const SHIP0 = D.SHIP_DEFAULT || { free: 499, codMax: 5000, zones: { A: 39, B: 49, C: 49, D: 79 }, cod: { A: true, B: true, C: true, D: false } };
  function readCatalog(snap) {
    const x = snap && snap.exists ? snap.data() : {};
    return {
      raw: x, px: x.px || {}, coupons: Array.isArray(x.coupons) ? x.coupons : D.COUPONS.map(k => Object.assign({}, k)),
      products: (Array.isArray(x.products) && x.products.length ? x.products : D.PRODUCTS).map(fromDb),
      cats: Array.isArray(x.cats) && x.cats.length ? x.cats : D.CATS, site: x.site || {},
      shipping: Object.assign({}, SHIP0, x.shipping || {}, { zones: Object.assign({}, SHIP0.zones, (x.shipping || {}).zones || {}), cod: Object.assign({}, SHIP0.cod, (x.shipping || {}).cod || {}) })
    };
  }
  A.readCatalog = readCatalog;

  // ---------- live data (one subscription set for the whole app) ----------
  A.subscribe = function (role, onData, onNewOrder) {
    const unsubs = [], state = { ready: {} };
    const push = (k, v) => { state[k] = v; state.ready[k] = true; onData(Object.assign({}, state)); };
    const err = k => e => { console.warn(k, e); state[k + 'Error'] = e.message || String(e); onData(Object.assign({}, state)); };
    const safe = (k, fn) => x => { try { fn(x); } catch (e) { err(k)(e); } };
    unsubs.push(db.doc('settings/catalog').onSnapshot(safe('catalog', s => push('catalog', readCatalog(s))), err('catalog')));
    let known = null;
    unsubs.push(db.collection('orders').orderBy('ts', 'desc').limit(1500).onSnapshot(safe('orders', qs => {
      const orders = qs.docs.map(d => d.data());
      if (known) qs.docChanges().forEach(ch => { if (ch.type === 'added' && !known.has(ch.doc.id)) onNewOrder && onNewOrder(ch.doc.data()); });
      known = new Set(orders.map(o => o.id));
      push('orders', orders);
    }), err('orders')));
    unsubs.push(db.collection('users').limit(5000).onSnapshot(qs => push('users', qs.docs.map(d => Object.assign({ uid: d.id }, d.data()))), err('users')));
    unsubs.push(db.collection('reviews').onSnapshot(qs => push('reviews', qs.docs.map(d => Object.assign({ _id: d.id }, d.data())).sort((a, b) => (b.ts || 0) - (a.ts || 0))), err('reviews')));
    unsubs.push(db.collection('leads').orderBy('ts', 'desc').limit(6000).onSnapshot(qs => push('leads', qs.docs.map(d => Object.assign({ _id: d.id }, d.data()))), err('leads')));
    unsubs.push(db.collection('inventory_log').orderBy('ts', 'desc').limit(400).onSnapshot(qs => push('hist', qs.docs.map(d => d.data())), err('hist')));
    if (A.canAdmin(role)) unsubs.push(db.collection('roles').onSnapshot(qs => push('roles', qs.docs.map(d => Object.assign({ email: d.id }, d.data()))), err('roles')));
    return () => unsubs.forEach(f => f());
  };

  // ---------- actions ----------
  const ev = msg => ({ t: stamp(), msg, ch: 'Admin · ' + me() });
  const orderRef = id => db.collection('orders').doc(id);
  const catRef = () => db.doc('settings/catalog');

  A.updateOrder = function (o, patch, msg) {
    const up = Object.assign({}, patch);
    if (msg) up.events = FV().arrayUnion(ev(msg));
    return orderRef(o.id).update(up);
  };

  A.setStatus = function (o, si, extra) {
    const patch = Object.assign({ si }, extra || {});
    if (si === 4 && /COD/.test(o.pay) && o.payStatus === 'COD pending') patch.payStatus = 'Paid';
    return A.updateOrder(o, patch, 'Status: ' + STATUSES[si] + (extra && extra.tracking ? ' · ' + (extra.courier || '') + ' ' + extra.tracking : ''));
  };

  // Cancel and put the stock back (safe if two people click at once).
  A.cancelOrder = function (o, reason) {
    return db.runTransaction(async tx => {
      const ref = orderRef(o.id), cref = catRef();
      const [os, cs] = [await tx.get(ref), await tx.get(cref)];
      const cur = os.data();
      if (!cur || cur.si === 5) return;
      const cat = readCatalog(cs), ch = {};
      (cur.items || []).forEach(it => {
        const p = cat.products.find(x => x.id === it.pid); if (!p) return;
        const vi = Number.isInteger(it.vi) ? it.vi : p.v.findIndex(x => x[0] === it.size); if (vi < 0) return;
        const key = p.id + ':' + vi, now = ch[key] ? ch[key].stock : A.vars(cat.px, p)[vi].stock;
        ch[key] = { stock: now + it.qty };
        tx.set(db.collection('inventory_log').doc(), { date: stamp(), sku: it.sku, type: 'Stock in', qty: it.qty, note: 'Cancelled ' + o.id, ts: Date.now() });
      });
      if (Object.keys(ch).length) tx.set(cref, { px: ch }, { merge: true });
      tx.update(ref, { si: 5, refund: cur.payStatus === 'Paid' ? 'Processing' : (cur.refund || ''), events: FV().arrayUnion(ev('Order cancelled' + (reason ? ' · ' + reason : '') + (cur.payStatus === 'Paid' ? ' · refund to be processed' : ''))) });
    });
  };

  A.adjustStock = function (pid, vi, delta, type, note) {
    return db.runTransaction(async tx => {
      const cs = await tx.get(catRef()), cat = readCatalog(cs);
      const p = cat.products.find(x => x.id === pid); if (!p) throw new Error('Product not found');
      const v = A.vars(cat.px, p)[vi]; if (!v) throw new Error('Pack not found');
      const stock = Math.max(0, v.stock + delta);
      tx.set(catRef(), { px: { [pid + ':' + vi]: { stock } } }, { merge: true });
      tx.set(db.collection('inventory_log').doc(), { date: stamp(), sku: v.sku, type, qty: Math.abs(delta), note: note || 'Manual adjustment', by: me(), ts: Date.now() });
    });
  };

  A.setPrice = function (pid, vi, field, value) {
    return catRef().set({ px: { [pid + ':' + vi]: { [field]: Math.max(0, Math.round(Number(value) || 0)) } } }, { merge: true });
  };

  // Save a product from the editor draft. Returns the product id.
  A.saveProduct = async function (d, cat) {
    const name = String(d.name || '').trim();
    if (!name) throw new Error('Please enter the product name.');
    const variants = (d.variants || []).filter(v => String(v.size || '').trim() || v.price);
    if (!variants.length) throw new Error('Add at least one pack size with a price.');
    for (const v of variants) {
      if (!String(v.size || '').trim()) throw new Error('Every pack needs a size, e.g. "250 g".');
      if (!(Number(v.price) > 0)) throw new Error('Every pack needs a selling price (' + v.size + ').');
      if (v.mrp && Number(v.mrp) < Number(v.price)) throw new Error('MRP cannot be lower than the selling price (' + v.size + ').');
    }
    const all = cat.products;
    const old = d.isNew ? null : all.find(p => p.id === d.id);
    let id = old ? old.id : slug(name) || 'product';
    if (!old) { let n = 2; const base = id; while (all.some(p => p.id === id)) id = base + '-' + n++; }
    const code = old && old.code ? old.code : name.replace(/^APAR\s+/i, '').split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 4) || 'P';
    const cats = cat.cats.map(k => Object.assign({}, k));
    let c = d.cat || (cats[0] && cats[0].slug);
    const newCat = String(d.newCat || '').trim();
    if (newCat) { const s = slug(newCat); if (!cats.some(k => k.slug === s)) cats.splice(Math.max(0, cats.length - 1), 0, { slug: s, name: newCat, img: (d.imgs || [])[0] || '' }); c = s; }
    const imgs = (d.imgs || []).filter(Boolean);
    const v = variants.map(x => {
      const size = String(x.size).trim(), price = Math.round(Number(x.price)), mrp = Math.round(Number(x.mrp) || price);
      return [size, Math.round(Number(x.g) || 0), mrp, price, 0, String(x.sku || '').trim() || ('APR-' + code + '-' + size.replace(/\s/g, '').toUpperCase())];
    });
    const details = {}; DETAILS.forEach(([k]) => { const val = String((d.details || {})[k] || '').trim(); if (val) details[k] = val; });
    const product = Object.assign({}, old || {}, {
      id, code, cat: c, name, short: String(d.short || '').trim(), uses: String(d.uses || '').trim(),
      featured: !!d.featured, hidden: !!d.hidden, img: imgs[0] || '', gallery: imgs, details,
      hsn: String(d.hsn || '').trim(), gst: d.gst === '' || d.gst == null ? '' : Number(d.gst), v
    });
    if (old && old.img !== product.img) delete product.pos;
    const products = old ? all.map(p => p.id === id ? product : p) : [...all, product];
    const px = {};
    variants.forEach((x, i) => { px[id + ':' + i] = { mrp: v[i][2], price: v[i][3], stock: Math.max(0, Math.round(Number(x.stock) || 0)) }; });
    for (let i = variants.length; old && i < old.v.length; i++) px[id + ':' + i] = FV().delete();
    await catRef().set({ products: products.map(toDb), cats, px }, { merge: true });
    return id;
  };
  A.setHidden = (cat, id, hidden) => catRef().set({ products: cat.products.map(p => p.id === id ? Object.assign({}, p, { hidden }) : p).map(toDb) }, { merge: true });
  A.deleteProduct = (cat, id) => catRef().set({ products: cat.products.filter(p => p.id !== id).map(toDb) }, { merge: true });
  A.saveCoupons = list => catRef().set({ coupons: list }, { merge: true });
  A.saveSite = site => catRef().set({ site }, { merge: true });
  A.saveShipping = sh => catRef().set({ shipping: sh }, { merge: true });
  A.setReview = (id, approved) => db.collection('reviews').doc(id).update({ approved });
  A.deleteReview = id => db.collection('reviews').doc(id).delete();
  A.updateLead = (id, patch) => db.collection('leads').doc(id).update(patch);
  A.deleteLead = id => db.collection('leads').doc(id).delete();
  // Lead Desk: log a call / WhatsApp on a lead (status, note, follow-up) and keep its history.
  A.logLead = function (l, p) {
    const t = Date.now(), entry = { t, by: me(), type: p.type || 'call', status: p.status, note: p.note || '' };
    const up = { status: p.status, lastAt: t, lastBy: me(), log: FV().arrayUnion(entry) };
    if (p.note) up.notes = p.note;
    if (p.follow !== undefined) up.follow = p.follow || '';
    if (p.value) up.value = Number(p.value) || 0;
    if (p.owner !== undefined) up.owner = p.owner;
    return db.collection('leads').doc(l._id).update(up);
  };
  A.addLead = lead => api('lead-admin', { action: 'add', lead });
  A.importLeads = (rows, mode) => api('lead-admin', { action: 'import', rows, mode });
  A.saveLeadTemplates = list => db.doc('settings/leadTemplates').set({ list, by: me(), ts: Date.now() });
  A.setRole = (email, role) => db.collection('roles').doc(String(email).trim().toLowerCase()).set({ role, addedBy: me(), ts: Date.now() });
  A.removeRole = email => db.collection('roles').doc(email).delete();
  A.notify = (id, kind) => api('order-notify', { id, kind });

  // ---------- photo upload (resized in the browser first) ----------
  function compress(file) {
    return new Promise((res, rej) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        const d = cv.toDataURL('image/webp', 0.85);
        res(d.indexOf('data:image/webp') === 0 ? d : cv.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Could not read "' + file.name + '". Please use a JPG or PNG photo.')); };
      img.src = url;
    });
  }
  A.upload = async file => (await api('upload-image', { data: await compress(file) })).url;

  // ---------- derived data ----------
  A.customers = function (users, orders) {
    const map = new Map();
    (users || []).forEach(u => map.set('u:' + u.uid, { key: 'u:' + u.uid, uid: u.uid, name: u.name || '', email: u.email || '', phone: '', city: '', joined: u.joined || '', addresses: u.addresses || [], orders: [], spent: 0, last: 0 }));
    (orders || []).forEach(o => {
      const k = o.uid ? 'u:' + o.uid : 'p:' + o.phone;
      if (!map.has(k)) map.set(k, { key: k, uid: o.uid || '', name: o.name, email: o.email || '', phone: o.phone, city: '', joined: o.date, addresses: [], orders: [], spent: 0, last: 0 });
      const c = map.get(k);
      c.orders.push(o); c.name = c.name || o.name; c.phone = c.phone || o.phone; c.email = c.email || o.email || ''; c.city = c.city || [o.city, o.pin].filter(Boolean).join(' ');
      if (o.si !== 5) c.spent += o.total || 0;
      c.last = Math.max(c.last, o.ts || 0);
    });
    return [...map.values()].sort((a, b) => b.last - a.last || b.spent - a.spent);
  };
  A.reserved = function (orders) {
    const r = {};
    (orders || []).filter(o => o.si < 2).forEach(o => (o.items || []).forEach(i => { r[i.sku] = (r[i.sku] || 0) + i.qty; }));
    return r;
  };
  A.itemsTxt = o => (o.items || []).map(i => i.name.replace('APAR ', '') + ' ' + i.size + ' × ' + i.qty).join(', ');
  A.statusOf = o => o.si === 5 ? 'Cancelled' : STATUSES[o.si] || 'Placed';

  // ---------- CSV export ----------
  A.csv = function (name, rows) {
    const t = rows.map(r => r.map(x => '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"').join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + t], { type: 'text/csv;charset=utf-8' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
  };
  A.exportOrders = orders => A.csv('APAR-Orders-' + todayISO() + '.csv', [['Order', 'Date', 'Customer', 'Phone', 'Email', 'Address', 'City', 'PIN', 'Items', 'Subtotal', 'Discount', 'Delivery', 'Total', 'Coupon', 'Payment', 'Payment status', 'Payment ID', 'Status', 'Courier', 'Tracking', 'Refund', 'Return', 'Admin note'],
    ...orders.map(o => [o.id, o.date, o.name, o.phone, o.email, o.address, o.city, o.pin, A.itemsTxt(o), o.sub, o.disc, o.ship, o.total, o.coupon, o.pay, o.payStatus, o.txn, A.statusOf(o), o.courier, o.tracking, o.refund, o.ret, o.adminNote])]);

  // ---------- printing: GST invoice & shipping labels ----------
  const RAJ = pin => /^3[0-4]/.test(String(pin || ''));
  function printWindow(title, body, css) {
    const w = window.open('', '_blank');
    if (!w) throw new Error('Your browser blocked the print window. Allow pop-ups for this site and try again.');
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>' + css + '</style></head><body>' + body + '<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>');
    w.document.close();
  }
  A.printInvoices = function (orders, cat) {
    if (!orders || !orders.length) throw new Error('Select at least one order');
    return window.AparInvoice.download(orders, { site: (cat && cat.site) || {}, products: (cat && cat.products) || window.APAR_DATA.PRODUCTS });
  };
  A.printInvoicesOld = function (orders, cat) {
    const S = cat.site || {}, gstin = S.gstin || '';
    const pages = orders.map(o => {
      const intra = RAJ(o.pin) && (!S.state || /rajasthan/i.test(S.state));
      const sub = o.sub || (o.items || []).reduce((a, i) => a + i.price * i.qty, 0), dr = sub ? (o.disc || 0) / sub : 0;
      let tTax = 0, tTaxable = 0;
      const rows = (o.items || []).map((i, n) => {
        const p = cat.products.find(x => x.id === i.pid) || {};
        const rate = p.gst === '' || p.gst == null ? null : Number(p.gst);
        const amt = i.price * i.qty * (1 - dr);
        const taxable = rate == null ? amt : amt / (1 + rate / 100), tax = amt - taxable;
        tTax += rate == null ? 0 : tax; tTaxable += taxable;
        const taxCells = rate == null ? '<td colspan="2" class="c">Incl.</td>' : intra
          ? `<td class="r">${(rate / 2)}% · ${inr2(tax / 2)}</td><td class="r">${(rate / 2)}% · ${inr2(tax / 2)}</td>`
          : `<td class="r" colspan="2">IGST ${rate}% · ${inr2(tax)}</td>`;
        return `<tr><td>${n + 1}</td><td>${esc(i.name)}<br><small>${esc(i.size)} · ${esc(i.sku || '')}</small></td><td>${esc(p.hsn || '')}</td><td class="r">${i.qty}</td><td class="r">${inr2(i.price)}</td><td class="r">${inr2(taxable)}</td>${taxCells}<td class="r">${inr2(amt)}</td></tr>`;
      }).join('');
      return `<div class="page"><table class="head"><tr><td><div class="brand">APAR</div><div>${esc(S.legalName || 'APAR')}</div><div class="muted">${esc(S.address || D.CONTACT.address)}${S.state ? ', ' + esc(S.state) : ''}<br>${esc(S.phone || D.CONTACT.phone)} · ${esc(S.email || D.CONTACT.email)}${gstin ? '<br>GSTIN: <b>' + esc(gstin) + '</b>' : ''}${S.fssai ? '<br>FSSAI Lic. No.: ' + esc(S.fssai) : ''}</div></td>
        <td class="r"><h1>TAX INVOICE</h1><div>Invoice no: <b>${esc(o.id)}</b></div><div>Date: ${esc(o.date)}</div><div>Payment: ${esc(o.pay)} · ${esc(o.payStatus)}</div>${o.txn ? '<div class="muted">Txn: ' + esc(o.txn) + '</div>' : ''}</td></tr></table>
        <div class="bill"><b>Bill / Ship to</b><br>${esc(o.name)}<br>${esc(o.address)}<br>${esc(o.city)} – ${esc(o.pin)}<br>Phone: ${esc(o.phone)}${o.email ? ' · ' + esc(o.email) : ''}<br><span class="muted">Place of supply: ${intra ? 'Rajasthan (intra-state)' : 'Outside Rajasthan (inter-state)'}</span></div>
        <table class="items"><tr><th>#</th><th>Item</th><th>HSN</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Taxable</th><th class="r">${intra ? 'CGST' : 'IGST'}</th><th class="r">${intra ? 'SGST' : ''}</th><th class="r">Amount</th></tr>${rows}
        ${o.ship ? `<tr><td></td><td>Delivery charges</td><td></td><td></td><td></td><td></td><td></td><td></td><td class="r">${inr2(o.ship)}</td></tr>` : ''}
        <tr class="tot"><td colspan="5" class="r">Totals</td><td class="r">${inr2(tTaxable)}</td><td class="r" colspan="2">${tTax ? 'GST ' + inr2(tTax) : ''}</td><td class="r">${inr2(o.total)}</td></tr></table>
        ${o.disc ? `<p class="muted">Includes discount of ${inr2(o.disc)}${o.coupon ? ' (coupon ' + esc(o.coupon) + ')' : ''}, applied proportionally before tax.</p>` : ''}
        <p class="muted">All prices are inclusive of GST.${tTax ? '' : ' Add HSN code and GST % on each product (Admin → Products) to show the tax breakup.'} This is a computer-generated invoice.</p>
        <div class="sign">For ${esc(S.legalName || 'APAR')}<br><br><br>Authorised signatory</div></div>`;
    }).join('');
    printWindow('APAR invoices', pages, `body{font-family:Arial,sans-serif;color:#1c2420;margin:0}.page{padding:28px 32px;page-break-after:always;font-size:12px}.head{width:100%}.brand{font-family:Georgia,serif;font-size:26px;letter-spacing:.25em;color:#0f3b2e}h1{margin:0 0 6px;font-size:18px;letter-spacing:.1em;color:#0f3b2e}.muted{color:#666}.r{text-align:right}.c{text-align:center}.bill{margin:16px 0;padding:10px 12px;border:1px solid #ddd;border-radius:6px;line-height:1.5}.items{width:100%;border-collapse:collapse}.items th{background:#0f3b2e;color:#fff;font-weight:600;padding:7px;text-align:left}.items th.r{text-align:right}.items td{border-bottom:1px solid #e5e5e5;padding:7px;vertical-align:top}.tot td{font-weight:700;border-top:2px solid #0f3b2e}small{color:#777}.sign{margin-top:36px;text-align:right}`);
  };
  const inr2 = n => '₹' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  A.printLabels = function (orders, cat) {
    const S = cat.site || {};
    const pages = orders.map(o => {
      const grams = (o.items || []).reduce((a, i) => { const p = cat.products.find(x => x.id === i.pid); const v = p && p.v.find(x => x[0] === i.size); return a + ((v && v[1]) || 0) * i.qty; }, 0);
      const cod = /COD/.test(o.pay) && o.payStatus !== 'Paid';
      return `<div class="label"><div class="top"><span class="brand">APAR</span><span class="mode ${cod ? 'cod' : ''}">${cod ? 'COD · COLLECT ' + inr(o.total) : 'PREPAID'}</span></div>
        <div class="to"><div class="k">DELIVER TO</div><div class="name">${esc(o.name)}</div><div>${esc(o.address)}</div><div>${esc(o.city)}</div><div class="pin">PIN ${esc(o.pin)}</div><div>📞 ${esc(o.phone)}</div></div>
        <div class="meta"><div><span class="k">ORDER</span><br><b>${esc(o.id)}</b></div><div><span class="k">DATE</span><br>${esc(o.date)}</div><div><span class="k">WEIGHT</span><br>${grams ? (grams / 1000).toFixed(2) + ' kg (net)' : '—'}</div></div>
        ${o.tracking ? `<div class="awb">${esc(o.courier || '')} · AWB <b>${esc(o.tracking)}</b></div>` : ''}
        <div class="items">${esc(A.itemsTxt(o))}</div>
        <div class="from"><span class="k">FROM</span> ${esc(S.legalName || 'APAR')}, ${esc(S.address || D.CONTACT.address)} · ${esc(S.phone || D.CONTACT.phone)}</div></div>`;
    }).join('');
    printWindow('APAR shipping labels', pages, `@page{size:4in 6in;margin:0}body{margin:0;font-family:Arial,sans-serif;color:#000}.label{width:4in;height:6in;box-sizing:border-box;padding:.18in;page-break-after:always;display:flex;flex-direction:column;gap:8px;font-size:12px}.top{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #000;padding-bottom:6px}.brand{font-family:Georgia,serif;font-size:22px;letter-spacing:.25em}.mode{font-weight:700;border:2px solid #000;padding:4px 8px}.mode.cod{background:#000;color:#fff}.to{border:2px solid #000;padding:8px;line-height:1.45;font-size:14px}.name{font-size:18px;font-weight:700}.pin{font-size:20px;font-weight:700;letter-spacing:.08em}.k{font-size:9px;letter-spacing:.15em;color:#444}.meta{display:flex;justify-content:space-between;border-bottom:1px dashed #000;padding-bottom:6px}.awb{font-size:15px;border:1px solid #000;padding:6px;text-align:center}.items{font-size:11px;flex:1}.from{font-size:10px;border-top:1px solid #000;padding-top:6px}`);
  };
})();
