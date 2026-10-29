// APAR Admin — Customers, Payments, Coupons, Reviews, B2B leads, Shipping, Settings.
(function () {
  const A = window.AA;
  const { useState, useEffect } = React;
  const { html, Btn, Badge, Card, Field, Empty, Stat, Tabs, Drawer, Icon, inr, cx } = A;

  // ---------------- Customers ----------------
  A.Customers = function ({ data, openOrder }) {
    const [q, setQ] = useState(''), [open, setOpen] = useState(null), [sort, setSort] = useState('recent');
    const list = A.customers(data.users, data.orders);
    const ql = q.trim().toLowerCase();
    let rows = list.filter(c => !ql || [c.name, c.email, c.phone, c.city].join(' ').toLowerCase().includes(ql));
    if (sort === 'spent') rows = rows.slice().sort((a, b) => b.spent - a.spent);
    if (sort === 'orders') rows = rows.slice().sort((a, b) => b.orders.length - a.orders.length);
    const { rows: page, pager } = A.usePage(rows, 50);
    const c = open && list.find(x => x.key === open);
    const repeat = list.filter(x => x.orders.filter(o => o.si !== 5).length > 1).length;
    return html`<div className="page">
      <div className="page-h"><div><h1>Customers</h1><p className="muted">${list.length} customers · ${repeat} repeat buyers</p></div>
        <${Btn} icon="dl" onClick=${() => A.csv('APAR-Customers-' + A.todayISO() + '.csv', [['Name', 'Email', 'Phone', 'City', 'Joined', 'Orders', 'Total spent', 'Last order'], ...rows.map(c => [c.name, c.email, c.phone, c.city, c.joined, c.orders.length, c.spent, c.last ? new Date(c.last).toLocaleDateString('en-IN') : ''])])}>Export</${Btn}></div>
      <div className="filters"><div className="search"><${Icon} n="search" s=${16} /><input value=${q} onChange=${e => setQ(e.target.value)} placeholder="Search name, email, phone, city" aria-label="Search customers" /></div>
        <select className="sel" value=${sort} onChange=${e => setSort(e.target.value)} aria-label="Sort"><option value="recent">Most recent</option><option value="spent">Highest spend</option><option value="orders">Most orders</option></select></div>
      <div className="card" style=${{ padding: 0 }}>${rows.length ? html`<div className="tbl-wrap"><table className="tbl clickable"><thead><tr><th>Customer</th><th>Phone</th><th>City</th><th className="r">Orders</th><th className="r">Total spent</th><th>Last order</th></tr></thead><tbody>
        ${page.map(c => html`<tr key=${c.key} onClick=${() => setOpen(c.key)}><td><b>${c.name || '—'}</b><div className="sub">${c.email || (c.uid ? 'Registered' : 'Guest')}</div></td><td>${c.phone || '—'}</td><td>${c.city || '—'}</td><td className="r">${c.orders.length}</td><td className="r">${inr(c.spent)}</td><td className="sub">${c.last ? new Date(c.last).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No orders'}</td></tr>`)}
      </tbody></table></div>${pager}` : html`<${Empty} icon="users" title="No customers yet" text="People appear here when they sign up or place an order." />`}</div>
      ${c && html`<${Drawer} open=${true} onClose=${() => setOpen(null)} title=${c.name || 'Customer'} sub=${[c.email, c.phone, c.city].filter(Boolean).join(' · ')}>
        <div className="stats small"><${Stat} label="Orders" value=${c.orders.length} /><${Stat} label="Total spent" value=${inr(c.spent)} /><${Stat} label="Joined" value=${c.joined || '—'} /></div>
        <div className="row gap8 wrap" style=${{ margin: '12px 0' }}>${c.phone && html`<${Btn} small icon="phone" href=${'tel:+91' + c.phone}>Call</${Btn}><${Btn} small icon="wa" href=${'https://wa.me/91' + String(c.phone).slice(-10)} target="_blank">WhatsApp</${Btn}>`}${c.email && html`<${Btn} small icon="mail" href=${'mailto:' + c.email}>Email</${Btn}>`}</div>
        ${c.addresses.length > 0 && html`<${Card} title="Saved addresses">${c.addresses.map((a, i) => html`<div key=${i} className="addr" style=${{ marginBottom: 10 }}><b>${a.name}</b> · ${a.phone}<br />${a.address}, ${a.city} ${a.pin}</div>`)}</${Card}>`}
        <${Card} title="Orders" pad=${false}>${c.orders.length ? html`<table className="tbl clickable"><tbody>${c.orders.map(o => html`<tr key=${o.id} onClick=${() => { setOpen(null); openOrder(o.id); }}><td><b>${o.id}</b><div className="sub">${o.date}</div></td><td className="ellip">${A.itemsTxt(o)}</td><td className="r">${inr(o.total)}</td><td><${Badge} t=${A.statusOf(o)} /></td></tr>`)}</tbody></table>` : html`<${Empty} title="No orders yet" />`}</${Card}>
      </${Drawer}>`}
    </div>`;
  };

  // ---------------- Payments ----------------
  A.Payments = function ({ data, openOrder }) {
    const orders = data.orders || [];
    const [tab, setTab] = useState('online');
    const online = orders.filter(o => o.txn), cod = orders.filter(o => o.si !== 5 && o.payStatus === 'COD pending'), refunds = orders.filter(o => o.refund);
    const sum = l => l.reduce((a, o) => a + (o.total || 0), 0);
    const lists = { online, cod, refunds };
    const rows = lists[tab];
    return html`<div className="page">
      <div className="page-h"><div><h1>Payments</h1><p className="muted">Online payments are verified with Razorpay before an order is created.</p></div><${Btn} icon="ext" href="https://dashboard.razorpay.com/app/payments" target="_blank">Razorpay dashboard</${Btn}></div>
      <div className="stats"><${Stat} label="Collected online" value=${inr(sum(online.filter(o => o.payStatus === 'Paid')))} sub=${online.length + ' payments'} onClick=${() => setTab('online')} />
        <${Stat} label="COD to collect" value=${inr(sum(cod))} sub=${cod.length + ' orders'} tone=${cod.length ? 'amber' : ''} onClick=${() => setTab('cod')} />
        <${Stat} label="Refunds in progress" value=${inr(sum(refunds.filter(o => o.refund === 'Processing')))} sub=${refunds.filter(o => o.refund === 'Processing').length + ' to process'} tone=${refunds.some(o => o.refund === 'Processing') ? 'red' : ''} onClick=${() => setTab('refunds')} /></div>
      <${Tabs} value=${tab} onChange=${setTab} items=${[['online', 'Online payments', online.length], ['cod', 'COD to collect', cod.length], ['refunds', 'Refunds', refunds.length]]} />
      <div className="card" style=${{ padding: 0 }}>${rows.length ? html`<div className="tbl-wrap"><table className="tbl clickable"><thead><tr><th>Order</th><th>Customer</th><th className="r">Amount</th><th>${tab === 'online' ? 'Razorpay payment ID' : 'Order status'}</th><th>${tab === 'refunds' ? 'Refund' : 'Payment'}</th></tr></thead><tbody>
        ${rows.map(o => html`<tr key=${o.id} onClick=${() => openOrder(o.id)}><td><b>${o.id}</b><div className="sub">${o.date}</div></td><td>${o.name}<div className="sub">${o.phone}</div></td><td className="r">${inr(o.total)}</td><td>${tab === 'online' ? html`<span className="mono">${o.txn}</span>` : html`<${Badge} t=${A.statusOf(o)} />`}</td><td><${Badge} t=${tab === 'refunds' ? o.refund : o.payStatus} /></td></tr>`)}
      </tbody></table></div>` : html`<${Empty} icon="pay" title="Nothing here yet" />`}</div>
      ${tab === 'refunds' && html`<p className="sub">To refund: open the payment in your Razorpay dashboard → Refund. Then open the order here and set Refund to "Refunded" (the customer can be emailed automatically).</p>`}
    </div>`;
  };

  // ---------------- Coupons ----------------
  const couponState = k => !k.active ? 'Paused' : (k.expires && A.todayISO() > k.expires) ? 'Expired' : (k.maxUses && (k.uses || 0) >= k.maxUses) ? 'Used up' : 'Active';
  A.Coupons = function ({ data }) {
    const cat = data.catalog;
    const [f, setF] = useState({ code: '', type: 'pct', value: '', min: '', maxUses: '', expires: '', hidden: false });
    if (!cat) return null;
    const list = cat.coupons;
    const save = (next, msg) => A.run(A.saveCoupons(next), msg);
    const add = () => {
      const code = f.code.trim().toUpperCase().replace(/\s/g, '');
      if (!code) return A.toast('Enter a coupon code', 'error');
      if (!(Number(f.value) > 0)) return A.toast('Enter the discount value', 'error');
      if (f.type === 'pct' && Number(f.value) > 90) return A.toast('Percentage discount must be 90% or less', 'error');
      const k = { code, type: f.type, value: Number(f.value), min: Number(f.min) || 0, active: true, uses: 0 };
      if (Number(f.maxUses) > 0) k.maxUses = Number(f.maxUses);
      if (f.expires) k.expires = f.expires;
      if (f.hidden) k.hidden = true;
      const old = list.find(x => x.code === code);
      if (old) k.uses = old.uses || 0;
      save([k, ...list.filter(x => x.code !== code)], 'Coupon ' + code + (old ? ' updated' : ' created')).then(() => setF({ code: '', type: 'pct', value: '', min: '', maxUses: '', expires: '', hidden: false }));
    };
    const upd = (code, o) => save(list.map(x => x.code === code ? Object.assign({}, x, o) : x), 'Coupon updated');
    return html`<div className="page">
      <div className="page-h"><div><h1>Coupons</h1><p className="muted">Discount codes customers enter in the cart. Checked again on the server at checkout.</p></div></div>
      <${Card} title="Create coupon"><div className="form-grid four">
        <${Field} label="Code"><input value=${f.code} onChange=${e => setF(Object.assign({}, f, { code: e.target.value.toUpperCase() }))} placeholder="DIWALI20" /></${Field}>
        <${Field} label="Type"><select value=${f.type} onChange=${e => setF(Object.assign({}, f, { type: e.target.value }))}><option value="pct">% off</option><option value="flat">₹ off</option></select></${Field}>
        <${Field} label=${f.type === 'pct' ? 'Discount %' : 'Discount ₹'}><input type="number" value=${f.value} onChange=${e => setF(Object.assign({}, f, { value: e.target.value }))} /></${Field}>
        <${Field} label="Min. order ₹"><input type="number" value=${f.min} onChange=${e => setF(Object.assign({}, f, { min: e.target.value }))} placeholder="0" /></${Field}>
        <${Field} label="Max. uses (optional)"><input type="number" value=${f.maxUses} onChange=${e => setF(Object.assign({}, f, { maxUses: e.target.value }))} placeholder="Unlimited" /></${Field}>
        <${Field} label="Valid until (optional)"><input type="date" value=${f.expires} onChange=${e => setF(Object.assign({}, f, { expires: e.target.value }))} /></${Field}>
        <label className="check"><input type="checkbox" checked=${f.hidden} onChange=${e => setF(Object.assign({}, f, { hidden: e.target.checked }))} /> Secret code (not shown in the cart)</label>
        <div className="row" style=${{ alignItems: 'end' }}><${Btn} kind="primary" icon="plus" onClick=${add}>Save coupon</${Btn}></div>
      </div></${Card}>
      <div className="card" style=${{ padding: 0 }}>${list.length ? html`<div className="tbl-wrap"><table className="tbl"><thead><tr><th>Code</th><th>Offer</th><th>Min. order</th><th>Used</th><th>Valid until</th><th>Status</th><th></th></tr></thead><tbody>
        ${list.map(k => html`<tr key=${k.code}><td><b className="mono">${k.code}</b>${k.hidden && html`<div className="sub">secret</div>`}</td><td>${k.type === 'pct' ? k.value + '% off' : inr(k.value) + ' off'}</td><td>${k.min ? inr(k.min) : '—'}</td><td>${k.uses || 0}${k.maxUses ? ' / ' + k.maxUses : ''}</td><td>${k.expires || '—'}</td><td><${Badge} t=${couponState(k)} /></td>
          <td className="r nowrap"><${Btn} small onClick=${() => upd(k.code, { active: !k.active })}>${k.active ? 'Pause' : 'Activate'}</${Btn}> <${Btn} small kind="danger-ghost" onClick=${async () => { if (await A.confirm({ title: 'Delete ' + k.code + '?', text: 'Customers will no longer be able to use it.', ok: 'Delete', danger: true })) save(list.filter(x => x.code !== k.code), 'Coupon deleted'); }}>Delete</${Btn}></td></tr>`)}
      </tbody></table></div>` : html`<${Empty} icon="tag" title="No coupons" />`}</div>
    </div>`;
  };

  // ---------------- Reviews ----------------
  A.Reviews = function ({ data }) {
    const [tab, setTab] = useState('pending');
    const all = data.reviews || [], cat = data.catalog;
    const rows = all.filter(r => tab === 'pending' ? !r.approved : r.approved);
    const pname = id => ((cat && cat.products.find(p => p.id === id)) || {}).name || id;
    return html`<div className="page"><div className="page-h"><div><h1>Reviews</h1><p className="muted">Reviews appear on the product page only after you approve them.</p></div></div>
      <${Tabs} value=${tab} onChange=${setTab} items=${[['pending', 'Waiting for approval', all.filter(r => !r.approved).length], ['published', 'Published', all.filter(r => r.approved).length]]} />
      ${rows.length ? html`<div className="stack">${rows.map(r => html`<${Card} key=${r._id}><div className="row between wrap gap8"><div><b>${r.name}</b> <span className="stars">${'★'.repeat(r.rating)}<span className="dim">${'★'.repeat(5 - r.rating)}</span></span><div className="sub">${pname(r.pid)} · ${r.date}</div></div>
        <div className="row gap8">${r.approved ? html`<${Btn} small onClick=${() => A.run(A.setReview(r._id, false), 'Review unpublished')}>Unpublish</${Btn}>` : html`<${Btn} small kind="primary" icon="check" onClick=${() => A.run(A.setReview(r._id, true), 'Review published')}>Approve</${Btn}>`}<${Btn} small kind="danger-ghost" onClick=${async () => { if (await A.confirm({ title: 'Delete this review?', text: 'This cannot be undone.', ok: 'Delete', danger: true })) A.run(A.deleteReview(r._id), 'Review deleted'); }}>Delete</${Btn}></div></div>
        <p style=${{ margin: '10px 0 0', lineHeight: 1.6 }}>${r.text}</p></${Card}>`)}</div>` : html`<${Empty} icon="star" title=${tab === 'pending' ? 'No reviews waiting' : 'No published reviews yet'} />`}
    </div>`;
  };

  // ---------------- B2B leads ----------------
  const LEAD_ST = ['New', 'Contacted', 'Quoted', 'Won', 'Lost'];
  A.Leads = function ({ data }) {
    const leads = data.leads || [];
    const [st, setSt] = useState('open'), [open, setOpen] = useState(null), [note, setNote] = useState('');
    const rows = leads.filter(l => st === 'all' ? true : st === 'open' ? !['Won', 'Lost'].includes(l.status || 'New') : (l.status || 'New') === st);
    const l = open && leads.find(x => x._id === open);
    useEffect(() => setNote(l ? l.notes || '' : ''), [open]);
    return html`<div className="page"><div className="page-h"><div><h1>B2B leads</h1><p className="muted">Bulk, distributor and gifting enquiries from the website.</p></div>
      <${Btn} icon="dl" onClick=${() => A.csv('APAR-Leads-' + A.todayISO() + '.csv', [['Date', 'Type', 'Name', 'Company', 'GSTIN', 'Phone', 'Email', 'Product', 'Quantity', 'Location', 'Message', 'Status', 'Follow-up', 'Owner', 'Notes'], ...leads.map(l => [l.date, l.type, l.name, l.company, l.gstin, l.phone, l.email, l.product, l.quantity, l.location, l.message, l.status || 'New', l.follow, l.owner, l.notes])])}>Export</${Btn}></div>
      <${Tabs} value=${st} onChange=${setSt} items=${[['open', 'Open', leads.filter(l => !['Won', 'Lost'].includes(l.status || 'New')).length], ...LEAD_ST.map(s => [s, s, leads.filter(l => (l.status || 'New') === s).length]), ['all', 'All', leads.length]]} />
      <div className="card" style=${{ padding: 0 }}>${rows.length ? html`<div className="tbl-wrap"><table className="tbl clickable"><thead><tr><th>Enquiry</th><th>Contact</th><th>Requirement</th><th>Location</th><th>Status</th><th>Follow-up</th></tr></thead><tbody>
        ${rows.map(l => html`<tr key=${l._id} onClick=${() => setOpen(l._id)}><td><b>${l.type}</b><div className="sub">${l.date}</div></td><td>${l.name}${l.company ? ' · ' + l.company : ''}<div className="sub">${l.phone}</div></td><td>${l.product || '—'}<div className="sub">${l.quantity || ''}</div></td><td>${l.location}</td><td><${Badge} t=${l.status || 'New'} /></td><td className="sub">${l.follow || '—'}</td></tr>`)}
      </tbody></table></div>` : html`<${Empty} icon="lead" title="No enquiries here" />`}</div>
      ${l && html`<${Drawer} open=${true} onClose=${() => setOpen(null)} title=${l.name + (l.company ? ' · ' + l.company : '')} sub=${l.type + ' · ' + l.date}>
        <div className="row gap8 wrap" style=${{ marginBottom: 12 }}><${Btn} small icon="phone" href=${'tel:' + l.phone}>${l.phone}</${Btn}><${Btn} small icon="wa" href=${'https://wa.me/' + (String(l.phone).replace(/\D/g, '').length === 10 ? '91' : '') + String(l.phone).replace(/\D/g, '') + '?text=' + encodeURIComponent('Hello ' + l.name + ', thank you for your enquiry with APAR.')} target="_blank">WhatsApp</${Btn}>${l.email && html`<${Btn} small icon="mail" href=${'mailto:' + l.email}>Email</${Btn}>`}</div>
        <${Card} title="Requirement"><div className="kvs"><div><span>Product</span>${l.product || '—'}</div><div><span>Quantity</span>${l.quantity || '—'}</div><div><span>Location</span>${l.location || '—'}</div><div><span>GSTIN</span>${l.gstin || '—'}</div></div>${l.message && html`<p style=${{ lineHeight: 1.6 }}>${l.message}</p>`}</${Card}>
        <${Card} title="Follow-up"><div className="form-grid">
          <${Field} label="Status"><select value=${l.status || 'New'} onChange=${e => A.run(A.updateLead(l._id, { status: e.target.value }), 'Status updated')}>${LEAD_ST.map(s => html`<option key=${s}>${s}</option>`)}</select></${Field}>
          <${Field} label="Follow-up date"><input type="date" value=${l.follow || ''} onChange=${e => A.run(A.updateLead(l._id, { follow: e.target.value }), 'Follow-up saved')} /></${Field}>
          <${Field} label="Owner"><${A.SaveInput} value=${l.owner || ''} placeholder="Sales person" onSave=${v => A.run(A.updateLead(l._id, { owner: v }), 'Owner saved')} /></${Field}>
          <${Field} label="Notes" wide=${true}><textarea rows="3" value=${note} onChange=${e => setNote(e.target.value)} placeholder="Quote sent, price discussed…"></textarea></${Field}>
        </div><div style=${{ marginTop: 8 }}><${Btn} small kind="primary" disabled=${note === (l.notes || '')} onClick=${() => A.run(A.updateLead(l._id, { notes: note }), 'Notes saved')}>Save notes</${Btn}></div></${Card}>
      </${Drawer}>`}
    </div>`;
  };

  // ---------------- Shipping ----------------
  const ZONES = [['A', 'Rajasthan', '30xxxx', '2–3 days'], ['B', 'Metro cities', '11, 40, 41, 50, 56, 60, 70', '3–5 days'], ['C', 'Rest of India', 'All other PIN codes', '4–7 days'], ['D', 'Remote (J&K, North-East)', '19xxxx, 79xxxx', '6–9 days']];
  A.Shipping = function ({ data }) {
    const cat = data.catalog;
    const [s, setS] = useState(null), [busy, setBusy] = useState(false);
    useEffect(() => { if (cat) setS(JSON.parse(JSON.stringify(cat.shipping))); }, [!!cat]);
    if (!cat || !s) return null;
    const dirty = JSON.stringify(s) !== JSON.stringify(cat.shipping);
    const save = async () => { setBusy(true); try { await A.run(A.saveShipping({ free: Number(s.free) || 0, codMax: Number(s.codMax) || 0, zones: Object.fromEntries(Object.entries(s.zones).map(([k, v]) => [k, Number(v) || 0])), cod: s.cod }), 'Delivery settings saved'); } catch (e) { } setBusy(false); };
    const toShip = (data.orders || []).filter(o => o.si === 1 || o.si === 2 || o.si === 3);
    return html`<div className="page narrow"><div className="page-h"><div><h1>Shipping & delivery</h1><p className="muted">Charges shown at checkout. The server always uses these values.</p></div><${Btn} kind="primary" disabled=${!dirty || busy} onClick=${save}>${busy ? 'Saving…' : 'Save changes'}</${Btn}></div>
      <${Card} title="Rules"><div className="form-grid">
        <${Field} label="Free delivery on orders above ₹" hint="After coupon discount."><input type="number" value=${s.free} onChange=${e => setS(Object.assign({}, s, { free: e.target.value }))} /></${Field}>
        <${Field} label="Cash on Delivery up to ₹" hint="COD is hidden above this order value."><input type="number" value=${s.codMax} onChange=${e => setS(Object.assign({}, s, { codMax: e.target.value }))} /></${Field}>
      </div></${Card}>
      <${Card} title="Delivery zones" pad=${false}><div className="tbl-wrap"><table className="tbl edit"><thead><tr><th>Zone</th><th>PIN codes</th><th>Delivery time</th><th>Charge ₹ (below free limit)</th><th>Cash on Delivery</th></tr></thead><tbody>
        ${ZONES.map(([k, name, pins, days]) => html`<tr key=${k}><td><b>${k} · ${name}</b></td><td className="sub">${pins}</td><td>${days}</td><td><input type="number" value=${s.zones[k]} onChange=${e => setS(Object.assign({}, s, { zones: Object.assign({}, s.zones, { [k]: e.target.value }) }))} style=${{ width: 90 }} /></td>
          <td><label className="check"><input type="checkbox" checked=${!!s.cod[k]} onChange=${e => setS(Object.assign({}, s, { cod: Object.assign({}, s.cod, { [k]: e.target.checked }) }))} /> Available</label></td></tr>`)}
      </tbody></table></div></${Card}>
      <${Card} title=${'Shipments in progress (' + toShip.length + ')'} pad=${false}>${toShip.length ? html`<table className="tbl"><tbody>${toShip.map(o => html`<tr key=${o.id}><td><b>${o.id}</b><div className="sub">${o.city} ${o.pin}</div></td><td><${Badge} t=${A.statusOf(o)} /></td><td className="sub">${o.courier || '—'} ${o.tracking || 'no tracking yet'}</td></tr>`)}</tbody></table>` : html`<${Empty} icon="truck" title="Nothing in transit" />`}</${Card}>
    </div>`;
  };

  // ---------------- Settings ----------------
  const SITE_FIELDS = [['legalName', 'Registered business name', 'As on GST certificate'], ['address', 'Business address', 'Used on invoices and labels'], ['state', 'State', 'Rajasthan'], ['phone', 'Business phone', '78519 78274'], ['email', 'Business email', 'aparfragrances@gmail.com'], ['gstin', 'GSTIN', '15 characters'], ['fssai', 'FSSAI licence no.', '14 digits'], ['announce', 'Announcement bar (top of website)', 'Free delivery on orders above ₹499 · Code APAR10 for 10% off'], ['notifyEmail', 'Send new-order emails to', 'aparfragrances@gmail.com'], ['lowStock', 'Low-stock alert at (units)', '10']];
  A.Settings = function ({ data, role }) {
    const cat = data.catalog;
    const [s, setS] = useState(null), [busy, setBusy] = useState(false);
    useEffect(() => { if (cat) setS(Object.assign({}, cat.site)); }, [!!cat]);
    if (!cat || !s) return null;
    const dirty = SITE_FIELDS.some(([k]) => String(s[k] || '') !== String(cat.site[k] || ''));
    const save = async () => { setBusy(true); const o = {}; SITE_FIELDS.forEach(([k]) => { o[k] = String(s[k] || '').trim(); }); try { await A.run(A.saveSite(o), 'Settings saved'); } catch (e) { } setBusy(false); };
    const roles = data.roles || [];
    const addRole = async () => {
      const f = await A.ask({ title: 'Add team member', text: 'They sign in at this admin page with this email (Google or email link). Staff can manage orders, customers, leads and reviews. Admins can also change products, prices, coupons and settings.', fields: [{ k: 'email', label: 'Email', type: 'email', ph: 'name@gmail.com' }, { k: 'role', label: 'Access', options: ['staff', 'admin'] }], ok: 'Add' });
      if (!f) return; if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email || '')) return A.toast('Enter a valid email', 'error');
      A.run(A.setRole(f.email, f.role), f.email + ' added as ' + f.role);
    };
    return html`<div className="page narrow"><div className="page-h"><div><h1>Settings</h1><p className="muted">Business details for invoices, website text and your team.</p></div><${Btn} kind="primary" disabled=${!dirty || busy} onClick=${save}>${busy ? 'Saving…' : 'Save changes'}</${Btn}></div>
      <${Card} title="Business & website"><div className="form-grid">${SITE_FIELDS.map(([k, l, ph]) => html`<${Field} key=${k} label=${l} wide=${k === 'announce' || k === 'address'}><input type=${k === 'lowStock' ? 'number' : 'text'} value=${s[k] || ''} placeholder=${ph} onChange=${e => setS(Object.assign({}, s, { [k]: e.target.value }))} /></${Field}>`)}</div>
        <p className="sub">New-order emails need email sending switched on once in Netlify (SMTP settings). See the README in your GitHub repository.</p></${Card}>
      ${A.canAdmin(role) && html`<${Card} title="Team & access" actions=${html`<${Btn} small icon="plus" onClick=${addRole}>Add member</${Btn}>`} pad=${false}>
        <table className="tbl"><tbody><tr><td><b>${A.OWNER_EMAILS[0]}</b></td><td><${Badge} t="Owner" tone="green" /></td><td className="sub">Full access, cannot be removed</td><td></td></tr>
        ${roles.map(r => html`<tr key=${r.email}><td><b>${r.email}</b></td><td><${Badge} t=${r.role === 'admin' ? 'Admin' : r.role === 'staff' ? 'Staff' : 'No access set'} tone=${r.role === 'admin' ? 'violet' : r.role === 'staff' ? 'blue' : 'red'} /></td><td className="sub">${r.role === 'admin' ? 'Everything, including team' : 'Orders, customers, leads, reviews, stock'}</td>
          <td className="r"><${Btn} small kind="danger-ghost" onClick=${async () => { if (await A.confirm({ title: 'Remove ' + r.email + '?', text: 'They lose access to the admin app immediately.', ok: 'Remove', danger: true })) A.run(A.removeRole(r.email), 'Access removed'); }}>Remove</${Btn}></td></tr>`)}</tbody></table></${Card}>`}
    </div>`;
  };
})();
