// APAR Admin — Dashboard and Orders.
(function () {
  const A = window.AA;
  const { useState, useMemo, useEffect } = React;
  const { html, Btn, Badge, Card, Field, Empty, Stat, Tabs, Drawer, Icon, inr, STATUSES, COURIERS, cx } = A;

  const DAY = 864e5;
  const inRange = (o, range) => { if (range === 'all') return true; const t = o.ts || 0; const now = Date.now(); if (range === 'today') return A.dayKey(t) === A.todayISO(); return t >= now - Number(range) * DAY; };

  // ---------------- Dashboard ----------------
  A.Dashboard = function ({ data, openOrder }) {
    const orders = data.orders || [], cat = data.catalog;
    const [range, setRange] = useState('30');
    const valid = orders.filter(o => o.si !== 5);
    const sel = valid.filter(o => inRange(o, range));
    const rev = sel.reduce((a, o) => a + (o.total || 0), 0);
    const todayRev = valid.filter(o => inRange(o, 'today')).reduce((a, o) => a + (o.total || 0), 0);
    const toPack = orders.filter(o => o.si === 0), toShip = orders.filter(o => o.si === 1);
    const codPending = orders.filter(o => o.si !== 5 && o.payStatus === 'COD pending');
    const returns = orders.filter(o => o.ret === 'Requested');
    const pendingReviews = (data.reviews || []).filter(r => !r.approved);
    const newLeads = (data.leads || []).filter(l => (l.status || 'New') === 'New');
    const lowLimit = Number((cat && cat.site.lowStock) || 10);
    const low = [];
    if (cat) cat.products.filter(p => !p.hidden).forEach(p => A.vars(cat.px, p).forEach(v => { if (v.stock <= lowLimit) low.push({ p, v }); }));
    const days = Number(range === 'all' || range === 'today' ? 30 : range);
    const series = [];
    for (let i = days - 1; i >= 0; i--) {
      const k = A.dayKey(Date.now() - i * DAY);
      series.push({ label: new Date(Date.now() - i * DAY).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), value: valid.filter(o => A.dayKey(o.ts || 0) === k).reduce((a, o) => a + o.total, 0) });
    }
    const byProduct = {};
    sel.forEach(o => (o.items || []).forEach(i => { const k = i.name.replace('APAR ', ''); byProduct[k] = byProduct[k] || { units: 0, rev: 0 }; byProduct[k].units += i.qty; byProduct[k].rev += i.qty * i.price; }));
    const top = Object.entries(byProduct).sort((a, b) => b[1].rev - a[1].rev).slice(0, 6);
    const customers = new Set(sel.map(o => o.uid || o.phone)).size;
    const todo = [
      [toPack.length, 'new orders to pack', 'orders/new', 'blue'], [toShip.length, 'packed orders to ship', 'orders/packed', 'amber'],
      [returns.length, 'return requests', 'orders/returns', 'red'], [low.length, 'packs low on stock', 'inventory', 'amber'],
      [pendingReviews.length, 'reviews to approve', 'reviews', 'violet'], [newLeads.length, 'new B2B enquiries', 'leads', 'blue']
    ].filter(x => x[0] > 0);

    return html`<div className="page">
      <div className="page-h"><div><h1>Dashboard</h1><p className="muted">Today ${A.today()} · ${inr(todayRev)} sales today</p></div>
        <select className="sel" value=${range} onChange=${e => setRange(e.target.value)} aria-label="Period"><option value="today">Today</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All time</option></select></div>
      <div className="stats">
        <${Stat} label="Sales" value=${inr(rev)} sub=${sel.length + ' orders'} />
        <${Stat} label="Average order" value=${inr(sel.length ? rev / sel.length : 0)} sub=${customers + ' customers'} />
        <${Stat} label="To pack" value=${toPack.length} sub="New orders" tone=${toPack.length ? 'blue' : ''} onClick=${() => A.go('orders/new')} />
        <${Stat} label="COD to collect" value=${inr(codPending.reduce((a, o) => a + o.total, 0))} sub=${codPending.length + ' orders'} onClick=${() => A.go('orders/cod')} />
      </div>
      <div className="grid-2">
        <${Card} title="Sales by day"><${A.Bars} data=${series} money=${true} /></${Card}>
        <${Card} title="Needs your attention">${todo.length ? html`<ul className="todo">${todo.map(([n, t, path, tone]) => html`<li key=${path}><button type="button" onClick=${() => A.go(path)}><span className=${'dot tone-' + tone}></span><b>${n}</b> ${t}<${Icon} n="right" s=${15} /></button></li>`)}</ul>` : html`<${Empty} icon="check" title="All caught up" text="No orders waiting, nothing low on stock." />`}</${Card}>
      </div>
      <div className="grid-2">
        <${Card} title="Top products" pad=${false}>${top.length ? html`<table className="tbl"><thead><tr><th>Product</th><th className="r">Units</th><th className="r">Sales</th></tr></thead><tbody>${top.map(([n, v]) => html`<tr key=${n}><td>${n}</td><td className="r">${v.units}</td><td className="r">${inr(v.rev)}</td></tr>`)}</tbody></table>` : html`<${Empty} title="No sales in this period" />`}</${Card}>
        <${Card} title="Latest orders" pad=${false} actions=${html`<${Btn} small onClick=${() => A.go('orders')}>View all</${Btn}>`}>${orders.length ? html`<table className="tbl clickable"><tbody>${orders.slice(0, 7).map(o => html`<tr key=${o.id} onClick=${() => openOrder(o.id)}><td><b>${o.id}</b><div className="sub">${o.date}</div></td><td>${o.name}<div className="sub">${o.city}</div></td><td className="r">${inr(o.total)}</td><td className="r"><${Badge} t=${A.statusOf(o)} /></td></tr>`)}</tbody></table>` : html`<${Empty} icon="orders" title="No orders yet" text="Orders from your website will appear here instantly." />`}</${Card}>
      </div>
    </div>`;
  };

  // ---------------- Orders list ----------------
  const TABS = [['all', 'All'], ['new', 'New'], ['packed', 'Packed'], ['shipped', 'Shipped'], ['delivered', 'Delivered'], ['cod', 'COD to collect'], ['returns', 'Returns'], ['cancelled', 'Cancelled']];
  const tabMatch = (o, t) => ({ all: true, new: o.si === 0, packed: o.si === 1, shipped: o.si === 2 || o.si === 3, delivered: o.si === 4, cod: o.si !== 5 && o.payStatus === 'COD pending', returns: !!o.ret, cancelled: o.si === 5 })[t];

  A.Orders = function ({ data, tab, query, openOrder }) {
    const orders = data.orders || [];
    const [q, setQ] = useState(query || '');
    const [pay, setPay] = useState('all');
    const [range, setRange] = useState('all');
    const [picked, setPicked] = useState({});
    useEffect(() => setQ(query || ''), [query]);
    const t = TABS.some(x => x[0] === tab) ? tab : 'all';
    const ql = q.trim().toLowerCase();
    const rows = orders.filter(o => tabMatch(o, t) && (pay === 'all' || o.payStatus === pay) && inRange(o, range) &&
      (!ql || [o.id, o.name, o.phone, o.email, o.city, o.pin, o.tracking].join(' ').toLowerCase().includes(ql)));
    const { rows: page, pager } = A.usePage(rows, 50);
    const sel = rows.filter(o => picked[o.id]);
    const allOn = page.length && page.every(o => picked[o.id]);
    const toggleAll = () => { const n = Object.assign({}, picked); page.forEach(o => { n[o.id] = !allOn; }); setPicked(n); };
    const cat = data.catalog;

    const bulkStatus = async si => {
      let extra = {};
      if (si === 2) {
        const r = await A.ask({ title: 'Mark ' + sel.length + ' order(s) as shipped', text: 'Courier is applied to all selected orders. You can add each tracking number in the order details.', fields: [{ k: 'courier', label: 'Courier', options: COURIERS, value: 'Delhivery' }], ok: 'Mark shipped' });
        if (!r) return; extra = { courier: r.courier };
      }
      await A.run(Promise.all(sel.filter(o => o.si !== 5).map(o => A.setStatus(o, si, Object.assign({}, extra, si === 2 && o.tracking ? {} : {})))), sel.length + ' order(s) marked ' + STATUSES[si]);
      setPicked({});
    };

    return html`<div className="page">
      <div className="page-h"><div><h1>Orders</h1><p className="muted">${orders.length} orders · updates live</p></div>
        <div className="row gap8 wrap"><${Btn} icon="dl" onClick=${() => A.exportOrders(rows)}>Export ${rows.length}</${Btn}></div></div>
      <${Tabs} value=${t} onChange=${k => A.go('orders/' + k)} items=${TABS.map(([k, l]) => [k, l, orders.filter(o => tabMatch(o, k)).length])} />
      <div className="filters">
        <div className="search"><${Icon} n="search" s=${16} /><input value=${q} onChange=${e => setQ(e.target.value)} placeholder="Search order ID, name, phone, PIN, tracking no." aria-label="Search orders" /></div>
        <select className="sel" value=${pay} onChange=${e => setPay(e.target.value)} aria-label="Payment"><option value="all">All payments</option><option>Paid</option><option>COD pending</option><option>Refunded</option><option>Failed</option></select>
        <select className="sel" value=${range} onChange=${e => setRange(e.target.value)} aria-label="Date"><option value="all">Any date</option><option value="today">Today</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select>
      </div>
      ${sel.length > 0 && html`<div className="bulk"><b>${sel.length} selected</b>
        <${Btn} small onClick=${() => bulkStatus(1)}>Mark packed</${Btn}><${Btn} small onClick=${() => bulkStatus(2)}>Mark shipped</${Btn}><${Btn} small onClick=${() => bulkStatus(4)}>Mark delivered</${Btn}>
        <${Btn} small icon="print" onClick=${() => A.run(Promise.resolve(A.printLabels(sel, cat)))}>Shipping labels</${Btn}><${Btn} small icon="print" onClick=${() => A.run(Promise.resolve(A.printInvoices(sel, cat)))}>Invoices</${Btn}>
        <${Btn} small icon="dl" onClick=${() => A.exportOrders(sel)}>Export</${Btn}><${Btn} small kind="link" onClick=${() => setPicked({})}>Clear</${Btn}></div>`}
      <div className="card" style=${{ padding: 0 }}>${rows.length ? html`<div className="tbl-wrap"><table className="tbl clickable">
        <thead><tr><th style=${{ width: 36 }}><input type="checkbox" checked=${!!allOn} onChange=${toggleAll} aria-label="Select all" /></th><th>Order</th><th>Customer</th><th>Items</th><th className="r">Total</th><th>Payment</th><th>Status</th><th>Tracking</th></tr></thead>
        <tbody>${page.map(o => html`<tr key=${o.id} className=${picked[o.id] ? 'picked' : ''} onClick=${() => openOrder(o.id)}>
          <td onClick=${e => e.stopPropagation()}><input type="checkbox" checked=${!!picked[o.id]} onChange=${() => setPicked(Object.assign({}, picked, { [o.id]: !picked[o.id] }))} aria-label=${'Select ' + o.id} /></td>
          <td><b>${o.id}</b>${o.note && html` <span title=${o.note}>⚠</span>`}<div className="sub">${o.date}</div></td>
          <td>${o.name}<div className="sub">${o.phone} · ${o.city} ${o.pin}</div></td>
          <td className="ellip" title=${A.itemsTxt(o)}>${A.itemsTxt(o)}</td>
          <td className="r"><b>${inr(o.total)}</b><div className="sub">${/COD/.test(o.pay) ? 'COD' : 'Online'}</div></td>
          <td><${Badge} t=${o.payStatus} /></td>
          <td><${Badge} t=${A.statusOf(o)} />${o.ret && html` <${Badge} t=${'Return ' + o.ret.toLowerCase()} tone="amber" />`}</td>
          <td className="sub">${o.tracking ? (o.courier || '') + ' ' + o.tracking : '—'}</td></tr>`)}</tbody></table></div>${pager}`
        : html`<${Empty} icon="orders" title=${orders.length ? 'No orders match' : 'No orders yet'} text=${orders.length ? 'Try another tab, search or date.' : 'New website orders appear here instantly, with a sound alert.'} />`}</div>
    </div>`;
  };

  // ---------------- Order details ----------------
  A.OrderDrawer = function ({ data, id, onClose }) {
    const o = (data.orders || []).find(x => x.id === id);
    const cat = data.catalog;
    const [courier, setCourier] = useState(''), [awb, setAwb] = useState(''), [note, setNote] = useState('');
    useEffect(() => { if (o) { setCourier(o.courier || 'Delhivery'); setAwb(o.tracking || ''); setNote(o.adminNote || ''); } }, [id, o && o.courier, o && o.tracking, o && o.adminNote]);
    if (!id) return null;
    if (!o) return html`<${Drawer} open=${true} onClose=${onClose} title=${id}><${Empty} title="Order not found" text="It may still be loading." /></${Drawer}>`;
    const status = A.statusOf(o), cancelled = o.si === 5;
    const next = cancelled ? null : o.si < 4 ? o.si + 1 : null;
    const addr = [o.name, o.address, o.city + ' ' + o.pin, 'Phone: ' + o.phone].join('\n');
    const wa = (msg) => 'https://wa.me/91' + String(o.phone || '').replace(/\D/g, '').slice(-10) + '?text=' + encodeURIComponent(msg);
    const shipMsg = `Hello ${o.name}, your APAR order ${o.id} has been shipped${o.courier ? ' via ' + o.courier : ''}${o.tracking ? '. Tracking no: ' + o.tracking : ''}. Track here: ${location.origin}/#/track/${o.id}`;

    const doStatus = async si => {
      const extra = {};
      if (si === 2) { if (!awb.trim()) { const ok = await A.confirm({ title: 'Ship without tracking number?', text: 'You can add the tracking number later, but customers see it on the tracking page.', ok: 'Ship anyway' }); if (!ok) return; } extra.courier = courier; extra.tracking = awb.trim(); }
      await A.run(A.setStatus(o, si, extra), 'Order ' + o.id + ' → ' + STATUSES[si]);
      if (si === 2 || si === 3 || si === 4) offerNotify(si === 2 ? 'shipped' : si === 3 ? 'out' : 'delivered');
    };
    const offerNotify = async kind => {
      if (!o.email) return;
      const ok = await A.confirm({ title: 'Email the customer?', text: 'Send ' + o.email + ' an update that the order is ' + ({ shipped: 'shipped', out: 'out for delivery', delivered: 'delivered', cancelled: 'cancelled', refunded: 'refunded' })[kind] + '.', ok: 'Send email' });
      if (!ok) return;
      try { const r = await A.notify(o.id, kind); A.toast(r.sent ? 'Email sent to ' + o.email : r.reason, r.sent ? 'ok' : 'error'); } catch (e) { A.toast(e.message, 'error'); }
    };
    const cancel = async () => {
      const r = await A.ask({ title: 'Cancel order ' + o.id + '?', text: 'Stock is put back automatically.' + (o.payStatus === 'Paid' ? ' The customer paid online: refund them from your Razorpay dashboard, then mark the refund as Refunded here.' : ''), fields: [{ k: 'reason', label: 'Reason (optional)', ph: 'e.g. customer request, out of stock' }], ok: 'Cancel order' });
      if (!r) return;
      await A.run(A.cancelOrder(o, r.reason), 'Order cancelled and stock restored');
      offerNotify('cancelled');
    };

    return html`<${Drawer} open=${true} onClose=${onClose} wide=${true} title=${html`Order ${o.id} <${Badge} t=${status} /> <${Badge} t=${o.payStatus} />`} sub=${o.date + ' · ' + inr(o.total) + ' · ' + o.pay}
      footer=${html`<${Btn} icon="print" onClick=${() => A.run(Promise.resolve(A.printInvoices([o], cat)))}>GST invoice</${Btn}><${Btn} icon="print" onClick=${() => A.run(Promise.resolve(A.printLabels([o], cat)))}>Shipping label</${Btn}><span className="grow"></span>${!cancelled && o.si < 2 && html`<${Btn} kind="danger-ghost" onClick=${cancel}>Cancel order</${Btn}>`}${next != null && html`<${Btn} kind="primary" onClick=${() => doStatus(next)}>Mark ${STATUSES[next].toLowerCase()}</${Btn}>`}`}>
      ${o.note && html`<div className="alert"><${Icon} n="alert" /> ${o.note}</div>`}
      <div className="steps">${STATUSES.slice(0, 5).map((s, i) => html`<button key=${s} type="button" className=${cx('step', !cancelled && i <= o.si && 'done', !cancelled && i === o.si && 'cur')} disabled=${cancelled || i === o.si} onClick=${() => doStatus(i)} title=${'Set status: ' + s}><span className="step-dot">${!cancelled && i < o.si ? '✓' : i + 1}</span>${s}</button>`)}</div>
      ${cancelled && html`<div className="alert grey">This order was cancelled.</div>`}

      <div className="grid-2 tight">
        <${Card} title="Customer">
          <div className="kv"><b>${o.name}</b></div>
          <div className="row gap8 wrap" style=${{ margin: '8px 0 12px' }}>
            <${Btn} small icon="phone" href=${'tel:+91' + o.phone}>${o.phone}</${Btn}>
            <${Btn} small icon="wa" href=${wa('Hello ' + o.name + ', this is APAR about your order ' + o.id + '.')} target="_blank">WhatsApp</${Btn}>
            ${o.email && html`<${Btn} small icon="mail" href=${'mailto:' + o.email + '?subject=' + encodeURIComponent('Your APAR order ' + o.id)}>Email</${Btn}>`}
          </div>
          <div className="addr">${o.address}<br />${o.city} – <b>${o.pin}</b></div>
          <div className="row gap8 wrap" style=${{ marginTop: 10 }}><${Btn} small icon="copy" onClick=${() => A.copy(addr, 'Address')}>Copy address</${Btn}><${Btn} small icon="map" href=${'https://maps.google.com/?q=' + encodeURIComponent(o.address + ', ' + o.city + ' ' + o.pin)} target="_blank">Map</${Btn}></div>
          ${o.email && html`<div className="sub" style=${{ marginTop: 10 }}>${o.email}${o.uid ? ' · registered customer' : ' · guest checkout'}</div>`}
        </${Card}>
        <${Card} title="Shipping">
          <div className="form-grid">
            <${Field} label="Courier"><select value=${courier} onChange=${e => setCourier(e.target.value)}>${COURIERS.map(c => html`<option key=${c}>${c}</option>`)}</select></${Field}>
            <${Field} label="Tracking / AWB no."><input value=${awb} onChange=${e => setAwb(e.target.value)} placeholder="e.g. 1234567890" /></${Field}>
          </div>
          <div className="row gap8 wrap" style=${{ marginTop: 10 }}>
            <${Btn} small kind="primary" disabled=${courier === (o.courier || '') && awb === (o.tracking || '')} onClick=${() => A.run(A.updateOrder(o, { courier, tracking: awb.trim() }, 'Tracking: ' + courier + ' ' + awb.trim()), 'Tracking saved')}>Save tracking</${Btn}>
            <${Btn} small icon="wa" href=${wa(shipMsg)} target="_blank">Send tracking on WhatsApp</${Btn}>
            ${o.email && html`<${Btn} small icon="mail" onClick=${() => offerNotify('shipped')}>Email update</${Btn}>`}
          </div>
          <div className="sub" style=${{ marginTop: 10 }}>Customer tracking page: <a href=${'/#/track/' + o.id} target="_blank">${location.host}/#/track/${o.id}</a></div>
        </${Card}>
      </div>

      <${Card} title="Items" pad=${false}><table className="tbl"><thead><tr><th>Product</th><th>SKU</th><th className="r">Qty</th><th className="r">Price</th><th className="r">Amount</th></tr></thead><tbody>
        ${(o.items || []).map((i, n) => html`<tr key=${n}><td>${i.name}<div className="sub">${i.size}</div></td><td className="sub">${i.sku}</td><td className="r">${i.qty}</td><td className="r">${inr(i.price)}</td><td className="r">${inr(i.price * i.qty)}</td></tr>`)}
        <tr className="sum"><td colSpan="4" className="r">Subtotal</td><td className="r">${inr(o.sub)}</td></tr>
        ${o.disc ? html`<tr className="sum"><td colSpan="4" className="r">Discount ${o.coupon && '(' + o.coupon + ')'}</td><td className="r">−${inr(o.disc)}</td></tr>` : null}
        <tr className="sum"><td colSpan="4" className="r">Delivery</td><td className="r">${o.ship ? inr(o.ship) : 'Free'}</td></tr>
        <tr className="sum total"><td colSpan="4" className="r">Total</td><td className="r">${inr(o.total)}</td></tr></tbody></table></${Card}>

      <div className="grid-2 tight">
        <${Card} title="Payment">
          <div className="form-grid">
            <${Field} label="Method"><input value=${o.pay} disabled /></${Field}>
            <${Field} label="Payment status"><select value=${o.payStatus} onChange=${e => A.run(A.updateOrder(o, { payStatus: e.target.value }, 'Payment: ' + e.target.value), 'Payment status updated')}>${['COD pending', 'Paid', 'Refunded', 'Failed'].map(s => html`<option key=${s}>${s}</option>`)}</select></${Field}>
            <${Field} label="Refund"><select value=${o.refund || ''} onChange=${e => { const v = e.target.value; A.run(A.updateOrder(o, Object.assign({ refund: v }, v === 'Refunded' ? { payStatus: 'Refunded' } : {}), v ? 'Refund ' + v.toLowerCase() : 'Refund cleared'), 'Refund updated').then(() => v === 'Refunded' && offerNotify('refunded')); }}><option value="">No refund</option><option>Processing</option><option>Refunded</option><option>Failed</option></select></${Field}>
            ${o.ret ? html`<${Field} label="Return request"><select value=${o.ret} onChange=${e => A.run(A.updateOrder(o, Object.assign({ ret: e.target.value }, e.target.value === 'Picked up' && o.payStatus === 'Paid' && !o.refund ? { refund: 'Processing' } : {}), 'Return ' + e.target.value.toLowerCase()), 'Return updated')}>${['Requested', 'Approved', 'Picked up', 'Rejected'].map(s => html`<option key=${s}>${s}</option>`)}</select></${Field}>` : null}
          </div>
          ${o.txn && html`<div className="sub" style=${{ marginTop: 10 }}>Razorpay payment: <a href=${'https://dashboard.razorpay.com/app/payments/' + o.txn} target="_blank" rel="noopener">${o.txn}</a> <button className="link" onClick=${() => A.copy(o.txn, 'Payment ID')}>copy</button></div>`}
        </${Card}>
        <${Card} title="Internal note">
          <textarea rows="4" value=${note} onChange=${e => setNote(e.target.value)} placeholder="Only your team sees this, e.g. gift wrap, call before delivery"></textarea>
          <div style=${{ marginTop: 8 }}><${Btn} small kind="primary" disabled=${note === (o.adminNote || '')} onClick=${() => A.run(A.updateOrder(o, { adminNote: note }), 'Note saved')}>Save note</${Btn}></div>
        </${Card}>
      </div>

      <${Card} title="Timeline"><ol className="timeline">${(o.events || []).slice().reverse().map((e, i) => html`<li key=${i}><span className="tl-dot"></span><div><div>${e.msg}</div><div className="sub">${e.t} · ${e.ch}</div></div></li>`)}</ol></${Card}>
    </${Drawer}>`;
  };
})();
