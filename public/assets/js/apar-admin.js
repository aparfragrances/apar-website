(function () {
  const T = (t, sub, o) => ({ isText: true, t: String(t ?? ''), sub: sub || '', fw: (o && o.fw) || '400', color: (o && o.color) || '#1c2420' });
  const SEL = (val, opts, on) => ({ isSel: true, val: String(val), opts, on });
  const IN = (val, on, type, w, ph) => ({ isIn: true, val: val ?? '', on, type: type || 'text', w: w || '90px', ph: ph || '' });
  const BT = btns => ({ isBtns: true, btns });
  const TABS = [['dashboard', 'Dashboard'], ['orders', 'Orders'], ['payments', 'Payments & Refunds'], ['customers', 'Customers'], ['products', 'Products & Pricing'], ['inventory', 'Inventory'], ['coupons', 'Coupons'], ['reviews', 'Reviews'], ['leads', 'B2B Leads'], ['shipping', 'Shipping'], ['reports', 'Reports'], ['site', 'Site settings']];
  const DETAILS = [['netQty', 'Net quantity'], ['ingredients', 'Ingredients'], ['nutrition', 'Nutrition per 100 g'], ['allergens', 'Allergens'], ['storage', 'Storage'], ['shelfLife', 'Shelf life'], ['manufacturer', 'Manufacturer / packer'], ['barcode', 'Barcode / GTIN']];
  const VAR_KEYS = ['size', 'g', 'mrp', 'price', 'stock', 'sku'];

  function newDraft() {
    const D = window.APAR_DATA;
    return { isNew: true, id: '', name: '', cat: (D.CATS[0] || {}).slug || '', newCat: '', short: '', uses: '', featured: false, hidden: false, imgs: [], variants: [{ size: '', g: '', mrp: '', price: '', stock: '', sku: '' }], details: {} };
  }
  function draftFrom(c, p) {
    const S = window.AparStore;
    return { isNew: false, id: p.id, name: p.name, cat: p.cat, newCat: '', short: p.short || '', uses: p.uses || '', featured: !!p.featured, hidden: !!p.hidden,
      imgs: (p.gallery && p.gallery.length ? p.gallery : [p.img]).filter(Boolean).slice(),
      variants: S.vars(c, p).map(v => ({ size: v.size, g: v.g, mrp: v.mrp, price: v.price, stock: v.stock, sku: v.sku })), details: Object.assign({}, p.details || {}) };
  }
  function editor(c, d) {
    const D = window.APAR_DATA;
    const upd = patch => c.setState(st => ({ pe: Object.assign({}, st.pe, patch, { msg: '', err: false }) }));
    const field = (label, key, ph, span) => ({ label, val: d[key] == null ? '' : String(d[key]), ph: ph || '', span: span || 'auto', on: e => upd({ [key]: e.target.value }) });
    const updVar = (i, k, val) => c.setState(st => ({ pe: Object.assign({}, st.pe, { variants: st.pe.variants.map((v, j) => j === i ? Object.assign({}, v, { [k]: val }) : v) }) }));
    return {
      title: d.isNew ? 'Add a new product' : 'Edit · ' + d.name,
      close: () => c.setState({ pe: null }),
      fields: [field('Product name', 'name', 'e.g. APAR Rose Petal Jam', '1/-1'), field('Short description', 'short', 'One or two lines shown on the product page', '1/-1'), field('Uses', 'uses', 'e.g. With milk, desserts, ice cream or paan', '1/-1'), field('Or create a new category', 'newCat', 'Leave empty to use the category above', 'auto')],
      cat: d.cat, onCat: e => upd({ cat: e.target.value }), catOpts: D.CATS.map(k => ({ v: k.slug, l: k.name })),
      featured: !!d.featured, onFeatured: e => upd({ featured: e.target.checked }),
      visible: !d.hidden, onVisible: e => upd({ hidden: !e.target.checked }),
      imgs: (d.imgs || []).map((src, i) => ({ src, label: i === 0 ? 'Main photo' : 'Photo ' + (i + 1), notMain: i !== 0,
        makeMain: () => upd({ imgs: [src, ...d.imgs.filter((x, j) => j !== i)] }), remove: () => upd({ imgs: d.imgs.filter((x, j) => j !== i) }) })),
      onFiles: e => { const files = Array.from(e.target.files || []); e.target.value = ''; window.AparCloud.uploadImages(c, files); },
      uploadText: d.uploading ? 'Uploading…' : '+ Add photos',
      vars: (d.variants || []).map((v, i) => { const o = { remove: () => upd({ variants: d.variants.filter((x, j) => j !== i) }) }; VAR_KEYS.forEach(k => { o[k] = v[k] == null ? '' : String(v[k]); o['on_' + k] = e => updVar(i, k, e.target.value); }); return o; }),
      addVar: () => upd({ variants: [...(d.variants || []), { size: '', g: '', mrp: '', price: '', stock: '', sku: '' }] }),
      details: DETAILS.map(([k, label]) => ({ label, val: (d.details || {})[k] || '', on: e => { const val = e.target.value; c.setState(st => ({ pe: Object.assign({}, st.pe, { details: Object.assign({}, st.pe.details, { [k]: val }) }) })); } })),
      save: () => window.AparCloud.saveProduct(c, d), saveText: d.busy ? 'Saving…' : d.isNew ? 'Add product to store' : 'Save changes',
      msg: d.msg || '', msgColor: d.err ? '#6d1a2a' : '#1f7a45'
    };
  }


  function build(c) {
    const S = window.AparStore, D = window.APAR_DATA, s = c.state, inr = S.inr;
    const tab = s.adminTab, set = o => c.setState(o);
    const valid = s.orders.filter(o => o.si !== 5), rev = valid.reduce((a, o) => a + o.total, 0);
    const itemsTxt = o => o.items.map(i => i.name.replace('APAR ', '') + ' ' + i.size + ' × ' + i.qty).join(', ');
    const tables = [];
    const out = { tabs: TABS.map(([k, label]) => ({ label, ...S.pill(tab === k), pick: () => set({ adminTab: k, pe: null }) })), isDash: tab === 'dashboard', isCoupons: tab === 'coupons', isShipping: tab === 'shipping', isInv: tab === 'inventory', isProducts: tab === 'products', isEditor: tab === 'products' && !!s.pe, isSite: tab === 'site', addProduct: () => set({ pe: newDraft() }), pe: s.pe ? editor(c, s.pe) : { fields: [], catOpts: [], imgs: [], vars: [], details: [] }, site: { fields: [] }, tables };
    const inv = [];
    (D.ALL_PRODUCTS || D.PRODUCTS).forEach(p => S.vars(c, p).forEach(v => { const reserved = s.orders.filter(o => o.si < 2).reduce((a, o) => a + o.items.filter(i => i.sku === v.sku).reduce((b, i) => b + i.qty, 0), 0); inv.push({ p, v, reserved }); }));
    if (tab === 'dashboard') {
      const by = {}; valid.forEach(o => o.items.forEach(i => { by[i.name] = (by[i.name] || 0) + i.price * i.qty; }));
      const bl = Object.entries(by).sort((a, b) => b[1] - a[1]), mx = bl.length ? bl[0][1] : 1;
      const customers = new Set(s.orders.map(o => o.phone)).size;
      Object.assign(out, {
        kpis: [['Revenue', inr(rev)], ['Orders', valid.length], ['Avg. order', inr(valid.length ? rev / valid.length : 0)], ['Customers', customers], ['To ship', s.orders.filter(o => o.si < 2).length], ['Low stock SKUs', inv.filter(x => x.v.stock <= 10).length], ['New leads', s.leads.filter(l => (l.status || 'New') === 'New').length], ['Pending reviews', Object.values(s.reviews).flat().filter(r => !r.approved).length]].map(([k, v]) => ({ k, v: String(v) })),
        bars: bl.map(([name, v]) => ({ name: name.replace('APAR ', ''), v: inr(v), pct: Math.round(v / mx * 100) + '%' })),
        alerts: inv.filter(x => x.v.stock <= 10).map(x => ({ name: x.p.name.replace('APAR ', '') + ' · ' + x.v.size, v: x.v.stock <= 0 ? 'Out of stock' : x.v.stock + ' left', color: x.v.stock <= 0 ? '#6d1a2a' : '#a0661c' }))
      });
      tables.push({ title: 'Recent orders', cols: ['Order', 'Customer', 'Total', 'Status'], rows: s.orders.slice(0, 5).map(o => ({ cells: [T(o.id, o.date, { fw: '600' }), T(o.name, o.city), T(inr(o.total)), T(D.STATUSES[o.si])] })) });
    }
    if (tab === 'orders') {
      const upd = (id, fn) => S.updateOrder(c, id, fn);
      tables.push({ title: 'Orders', minW: '1500px', exp: () => S.csv('APAR-Orders.csv', [['Order', 'Date', 'Customer', 'Phone', 'Email', 'Address', 'City', 'PIN', 'Items', 'Total', 'Payment', 'Pay status', 'Payment ID', 'Status', 'Courier', 'Tracking', 'Refund', 'Return', 'Note'], ...s.orders.map(o => [o.id, o.date, o.name, o.phone, o.email, o.address, o.city, o.pin, itemsTxt(o), o.total, o.pay, o.payStatus, o.txn, D.STATUSES[o.si], o.courier, o.tracking, o.refund, o.ret, o.note])]),
        cols: ['Order', 'Customer & delivery address', 'Items', 'Total', 'Payment status', 'Order status', 'Courier', 'Tracking no.', 'Return', 'Actions'], empty: !s.orders.length, emptyText: 'New orders will appear here automatically.',
        rows: s.orders.map(o => ({ cells: [T(o.id, o.date + (o.note ? ' · ⚠ ' + o.note : ''), { fw: '600' }), T(o.name + ' · ' + o.phone, [o.address, o.city, o.pin].filter(Boolean).join(', ') + (o.email ? ' · ' + o.email : '')), T(itemsTxt(o), o.coupon ? 'Coupon ' + o.coupon : ''), T(inr(o.total), o.pay + (o.txn ? ' · ' + o.txn : '')),
          SEL(o.payStatus, ['COD pending', 'Paid', 'Refunded', 'Failed'], e => { const v = e.target.value; upd(o.id, x => ({ ...x, payStatus: v, events: S.notify(x, 'Payment: ' + v) })); }),
          SEL(D.STATUSES[o.si], D.STATUSES, e => { const si = D.STATUSES.indexOf(e.target.value); upd(o.id, x => ({ ...x, si, payStatus: si === 4 && x.pay === 'COD' ? 'Paid' : x.payStatus, events: S.notify(x, 'Status: ' + e.target.value) })); }),
          IN(o.courier, e => { const v = e.target.value; upd(o.id, x => ({ ...x, courier: v })); }, 'text', '130px', 'e.g. Delhivery'),
          IN(o.tracking, e => { const v = e.target.value; upd(o.id, x => ({ ...x, tracking: v })); }, 'text', '150px', 'AWB / tracking no.'),
          o.ret ? SEL(o.ret, ['Requested', 'Approved', 'Picked up', 'Rejected'], e => { const v = e.target.value; upd(o.id, x => ({ ...x, ret: v, refund: v === 'Picked up' && x.payStatus === 'Paid' ? 'Processing' : x.refund, events: S.notify(x, 'Return ' + v.toLowerCase()) })); }) : T('—'),
          BT([{ l: 'Invoice', on: () => S.invoice(o) }, { l: 'WhatsApp', on: () => window.open('https://wa.me/91' + o.phone + '?text=' + encodeURIComponent('Hello ' + o.name + ', this is APAR about your order ' + o.id + '.'), '_blank') }, ...(o.si < 2 ? [{ l: 'Cancel', on: () => S.cancel(c, o) }] : [])])] })) });
    }
    if (tab === 'payments') {
      tables.push({ title: 'Transactions', exp: () => S.csv('APAR-Transactions.csv', [['Payment ID', 'Order', 'Amount', 'Method', 'Status', 'Date', 'Note'], ...s.txns.map(t => [t.id, t.order, t.amount, t.method, t.status, t.date, t.note])]), cols: ['Payment ID', 'Order', 'Amount', 'Method', 'Status', 'Date'], empty: !s.txns.length, emptyText: 'Online payments appear here once customers check out.',
        rows: s.txns.map(t => ({ cells: [T(t.id, t.note, { fw: '600' }), T(t.order), T(inr(t.amount)), T(t.method), T(t.status, '', { color: t.status === 'Failed' ? '#6d1a2a' : '#1f7a45' }), T(t.date)] })) });
      const refunds = s.orders.filter(o => o.refund);
      tables.push({ title: 'Refunds', cols: ['Order', 'Customer', 'Amount', 'Method', 'Refund status'], empty: !refunds.length, emptyText: 'No refunds.',
        rows: refunds.map(o => ({ cells: [T(o.id, '', { fw: '600' }), T(o.name), T(inr(o.total)), T(o.pay), SEL(o.refund, ['Processing', 'Refunded', 'Failed'], e => { const v = e.target.value; S.updateOrder(c, o.id, x => ({ ...x, refund: v, payStatus: v === 'Refunded' ? 'Refunded' : x.payStatus, events: S.notify(x, 'Refund ' + v.toLowerCase()) })); })] })) });
    }
    if (tab === 'customers') {
      const map = {};
      s.users.forEach(u => { map[u.contact] = { name: u.name, contact: u.contact, joined: u.joined, orders: 0, spent: 0, addr: (u.addresses || []).length }; });
      s.orders.forEach(o => { const k = o.user || o.phone; map[k] = map[k] || { name: o.name, contact: k, joined: o.date, orders: 0, spent: 0, addr: 0 }; map[k].phone = map[k].phone || o.phone; map[k].city = map[k].city || [o.city, o.pin].filter(Boolean).join(' '); if (o.si !== 5) { map[k].orders++; map[k].spent += o.total; } });
      const list = Object.values(map);
      tables.push({ title: 'Customers', exp: () => S.csv('APAR-Customers.csv', [['Name', 'Email / ID', 'Phone', 'City', 'Joined', 'Orders', 'Spent'], ...list.map(u => [u.name, u.contact, u.phone, u.city, u.joined, u.orders, u.spent])]), cols: ['Customer', 'Phone · City', 'Joined', 'Orders', 'Total spent', 'Saved addresses'], empty: !list.length, emptyText: 'Customers appear here when they sign up or order.',
        rows: list.map(u => ({ cells: [T(u.name, u.contact, { fw: '600' }), T(u.phone || '—', u.city || ''), T(u.joined), T(u.orders), T(inr(u.spent)), T(u.addr)] })) });
    }
    if (tab === 'products') {
      const ALL = D.ALL_PRODUCTS || D.PRODUCTS;
      const setPx = (pid, i, key) => e => { const val = Math.max(0, parseInt(e.target.value || '0', 10)); c.setState(st => ({ px: { ...st.px, [pid + ':' + i]: { ...(st.px[pid + ':' + i] || {}), [key]: val } } })); };
      tables.push({ title: 'All products', cols: ['Product', 'Category', 'Pack sizes', 'Shown on store', ''], rows: ALL.map(p => ({ cells: [T(p.name, (p.gallery || []).length + ' photo(s) · ' + p.id, { fw: '600' }), T(S.catName(p.cat) || p.cat), T(p.v.map(x => x[0]).join(' · ')),
        T(p.hidden ? 'Hidden' : 'Live', p.featured ? 'Signature product' : '', { color: p.hidden ? '#8b857a' : '#1f7a45' }),
        BT([{ l: 'Edit', on: () => { set({ pe: draftFrom(c, p) }); window.scrollTo({ top: 0, behavior: 'smooth' }); } }, { l: p.hidden ? 'Show on store' : 'Hide', on: () => window.AparCloud.setHidden(c, p.id, !p.hidden) }])] })) });
      tables.push({ title: 'Quick price edit (type a new value and click outside the box)', minW: '900px', exp: () => S.downloadCatalogue(c), cols: ['SKU', 'Product', 'Pack', 'MRP ₹', 'Price ₹', 'Discount', 'Stock'],
        rows: ALL.flatMap(p => S.vars(c, p).map(v => ({ cells: [T(v.sku), T(p.name.replace('APAR ', ''), S.catName(p.cat)), T(v.size), IN(v.mrp, setPx(p.id, v.i, 'mrp'), 'number'), IN(v.price, setPx(p.id, v.i, 'price'), 'number'), T(v.mrp ? Math.round((1 - v.price / v.mrp) * 100) + '%' : '—'), T(v.stock)] }))) });
      tables.push({ title: 'Categories', cols: ['Category', 'Products', 'Link'], rows: D.CATS.map(k => ({ cells: [T(k.name, '', { fw: '600' }), T(ALL.filter(p => p.cat === k.slug).length), T('/#/shop/' + k.slug)] })) });
    }
    if (tab === 'inventory') {
      const apply = (x) => () => { const q = parseInt(s.adj[x.v.sku] || '0', 10); if (!q) return; const type = s.adjType[x.v.sku] || 'Stock in'; const delta = type === 'Stock in' ? q : -q;
        c.setState(st => ({ px: S.setStock(st, x.p.id, x.v.i, x.v.stock + delta), adj: { ...st.adj, [x.v.sku]: '' }, hist: [{ date: S.stamp(), sku: x.v.sku, type, qty: q, note: 'Manual adjustment' }, ...st.hist] })); };
      tables.push({ title: 'SKU-wise inventory', minW: '1000px', exp: () => S.csv('APAR-Inventory.csv', [['SKU', 'Product', 'Pack', 'On hand', 'Reserved', 'Available', 'Status'], ...inv.map(x => [x.v.sku, x.p.name, x.v.size, x.v.stock + x.reserved, x.reserved, x.v.stock, x.v.stock <= 0 ? 'Out of stock' : x.v.stock <= 10 ? 'Low' : 'OK'])]),
        cols: ['SKU', 'Product', 'Reserved', 'Available', 'Status', 'Adjust', 'Qty', ''],
        rows: inv.map(x => ({ cells: [T(x.v.sku, '', { fw: '600' }), T(x.p.name.replace('APAR ', ''), x.v.size), T(x.reserved, 'in open orders'), T(x.v.stock), T(x.v.stock <= 0 ? 'Out of stock' : x.v.stock <= 10 ? 'Low stock' : 'In stock', '', { color: x.v.stock <= 0 ? '#6d1a2a' : x.v.stock <= 10 ? '#a0661c' : '#1f7a45' }),
          SEL(s.adjType[x.v.sku] || 'Stock in', ['Stock in', 'Stock out', 'Damaged'], e => { const v = e.target.value; c.setState(st => ({ adjType: { ...st.adjType, [x.v.sku]: v } })); }),
          IN(s.adj[x.v.sku] || '', e => { const v = e.target.value; c.setState(st => ({ adj: { ...st.adj, [x.v.sku]: v } })); }, 'number', '70px', '0'), BT([{ l: 'Apply', on: apply(x) }])] })) });
      tables.push({ title: 'Inventory history', exp: () => S.csv('APAR-Inventory-History.csv', [['Date', 'SKU', 'Type', 'Qty', 'Note'], ...s.hist.map(h => [h.date, h.sku, h.type, h.qty, h.note])]), cols: ['Date', 'SKU', 'Movement', 'Qty', 'Note'], empty: !s.hist.length, emptyText: 'Stock movements from sales, cancellations and adjustments appear here.',
        rows: s.hist.slice(0, 50).map(h => ({ cells: [T(h.date), T(h.sku, '', { fw: '600' }), T(h.type, '', { color: h.type === 'Stock in' ? '#1f7a45' : h.type === 'Damaged' ? '#6d1a2a' : '#1c2420' }), T((h.type === 'Stock in' ? '+' : '−') + h.qty), T(h.note)] })) });
    }
    if (tab === 'coupons') {
      out.addCoupon = e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); const code = String(f.code || '').trim().toUpperCase(); if (!code) return; c.setState(st => ({ coupons: [{ code, type: f.type, value: +f.value || 0, min: +f.min || 0, active: true, uses: 0 }, ...st.coupons.filter(k => k.code !== code)] })); e.target.reset(); };
      tables.push({ title: 'Coupons & offers', cols: ['Code', 'Offer', 'Min. order', 'Used', 'Status', ''],
        rows: s.coupons.map(k => ({ cells: [T(k.code, '', { fw: '600' }), T(k.type === 'pct' ? k.value + '% off' : '₹' + k.value + ' off'), T(k.min ? inr(k.min) : '—'), T(k.uses || 0), T(k.active ? 'Active' : 'Paused', '', { color: k.active ? '#1f7a45' : '#8b857a' }),
          BT([{ l: k.active ? 'Pause' : 'Activate', on: () => c.setState(st => ({ coupons: st.coupons.map(x => x.code === k.code ? { ...x, active: !x.active } : x) })) }, { l: 'Delete', on: () => c.setState(st => ({ coupons: st.coupons.filter(x => x.code !== k.code) })) }])] })) });
    }
    if (tab === 'reviews') {
      const all = []; Object.entries(s.reviews).forEach(([pid, list]) => list.forEach((r, i) => all.push({ pid, i, r })));
      const mod = (pid, i, fn) => c.setState(st => ({ reviews: { ...st.reviews, [pid]: fn(st.reviews[pid]) } }));
      tables.push({ title: 'Reviews', cols: ['Product', 'Customer', 'Rating', 'Review', 'Status', ''], empty: !all.length, emptyText: 'Customer reviews appear here for approval.',
        rows: all.map(({ pid, i, r }) => ({ cells: [T((S.find(pid) || {}).name), T(r.name, r.date), T(S.star(r.rating)), T(r.text), T(r.approved ? 'Published' : 'Pending', '', { color: r.approved ? '#1f7a45' : '#a0661c' }),
          BT([...(r.approved ? [] : [{ l: 'Approve', on: () => mod(pid, i, l => l.map((x, j) => j === i ? { ...x, approved: true } : x)) }]), { l: 'Delete', on: () => mod(pid, i, l => l.filter((x, j) => j !== i)) }])] })) });
    }
    if (tab === 'leads') {
      const upd = (i, k, v) => c.setState(st => ({ leads: st.leads.map((l, j) => j === i ? { ...l, [k]: v } : l) }));
      tables.push({ title: 'B2B leads & enquiries', minW: '1100px', exp: () => S.csv('APAR-Leads.csv', [['Date', 'Type', 'Name', 'Company', 'GSTIN', 'Phone', 'Email', 'Product', 'Quantity', 'Location', 'Message', 'Status', 'Follow-up', 'Owner'], ...s.leads.map(l => [l.date, l.type, l.name, l.company, l.gstin, l.phone, l.email, l.product, l.quantity, l.location, l.message, l.status || 'New', l.follow, l.owner])]),
        cols: ['Type', 'Contact', 'Requirement', 'Location', 'Status', 'Follow-up date', 'Owner'], empty: !s.leads.length, emptyText: 'Enquiries from the B2B, distributor and contact forms appear here.',
        rows: s.leads.map((l, i) => ({ cells: [T(l.type, l.date, { fw: '600' }), T(l.name + (l.company ? ' · ' + l.company : ''), l.phone + (l.gstin ? ' · GSTIN ' + l.gstin : '')), T((l.product || '—') + ' · ' + (l.quantity || '—'), l.message), T(l.location),
          SEL(l.status || 'New', ['New', 'Contacted', 'Quoted', 'Won', 'Lost'], e => upd(i, 'status', e.target.value)), IN(l.follow, e => upd(i, 'follow', e.target.value), 'date', '140px'), IN(l.owner, e => upd(i, 'owner', e.target.value), 'text', '110px', 'Sales rep')] })) });
    }
    if (tab === 'shipping') {
      tables.push({ title: 'Shipping zones (proposed rules)', cols: ['Zone', 'PIN codes', 'Delivery', 'Charge below ₹499', 'COD'],
        rows: [['A · Rajasthan', '30xxxx', '2–3 days', '₹39', 'Yes'], ['B · Metro', '11, 40, 41, 50, 56, 60, 70', '3–5 days', '₹49', 'Yes'], ['C · Rest of India', 'All other PIN codes', '4–7 days', '₹49', 'Yes'], ['D · Remote', '19xxxx, 79xxxx', '6–9 days', '₹79', 'No']].map(r => ({ cells: r.map((x, j) => T(x, '', { fw: j ? '400' : '600' })) })) });
      const toShip = s.orders.filter(o => o.si >= 1 && o.si <= 3);
      tables.push({ title: 'Shipments in progress', cols: ['Order', 'Destination', 'Status', 'Courier', 'Tracking no.'], empty: !toShip.length, emptyText: 'No shipments in progress.',
        rows: toShip.map(o => ({ cells: [T(o.id, '', { fw: '600' }), T(o.city, o.pin), T(D.STATUSES[o.si]), T(o.courier || '—'), T(o.tracking || 'Not assigned')] })) });
    }
    if (tab === 'reports') {
      const R = [['Orders', 'orders'], ['Transactions', 'payments'], ['Customers', 'customers'], ['Inventory', 'inventory'], ['B2B leads', 'leads']];
      tables.push({ title: 'Export reports', cols: ['Report', 'Rows', ''], rows: R.map(([name, t]) => ({ cells: [T(name, '', { fw: '600' }), T({ orders: s.orders.length, payments: s.txns.length, customers: new Set(s.orders.map(o => o.phone)).size + s.users.length, inventory: inv.length, leads: s.leads.length }[t]), BT([{ l: 'Open', on: () => set({ adminTab: t }) }])] })) });
      const bySku = {}; valid.forEach(o => o.items.forEach(i => { bySku[i.sku] = bySku[i.sku] || { name: i.name + ' ' + i.size, qty: 0, rev: 0 }; bySku[i.sku].qty += i.qty; bySku[i.sku].rev += i.qty * i.price; }));
      const rows = Object.entries(bySku).sort((a, b) => b[1].rev - a[1].rev);
      tables.push({ title: 'Sales by SKU', exp: () => S.csv('APAR-Sales-by-SKU.csv', [['SKU', 'Product', 'Units', 'Revenue'], ...rows.map(([k, v]) => [k, v.name, v.qty, v.rev])]), cols: ['SKU', 'Product', 'Units', 'Revenue'], rows: rows.map(([k, v]) => ({ cells: [T(k, '', { fw: '600' }), T(v.name), T(v.qty), T(inr(v.rev))] })) });
    }
    if (tab === 'site') {
      const cur = s.siteDraft || D.SITE || {};
      const upd = (k, v) => c.setState(st => ({ siteDraft: { ...(st.siteDraft || D.SITE || {}), [k]: v } }));
      out.site = { fields: [['Announcement bar (top of every page)', 'announce', 'Free delivery on orders above ₹499 · Code APAR10 for 10% off'], ['FSSAI licence number', 'fssai', '14-digit FSSAI number'], ['GSTIN', 'gstin', '15-character GSTIN']]
        .map(([label, k, ph]) => ({ label, ph, val: cur[k] || '', on: e => upd(k, e.target.value) })), save: () => window.AparCloud.saveSite(c, cur) };
    }
    tables.forEach(t => { t.minW = t.minW || '640px'; t.hasExp = !!t.exp; t.exp = t.exp || (() => {}); t.empty = !!t.empty; t.emptyText = t.emptyText || ''; });
    return out;
  }
  window.AparAdmin = { build };
})();
