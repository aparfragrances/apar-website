// APAR Admin — Website visitors: anonymous daily totals from the site's own counter.
(function () {
  const A = window.AA;
  const { useState, useEffect, useMemo } = React;
  const { html, Btn, Card, Stat, Tabs, cx } = A;
  const SRC_LABEL = { instagram: 'Instagram', facebook: 'Facebook', google: 'Google', whatsapp: 'WhatsApp', youtube: 'YouTube', direct: 'Typed the address / bookmark', other: 'Other websites' };
  const PAGE_LABEL = { home: 'Home page', shop: 'Shop', product: 'Product pages', cart: 'Cart', checkout: 'Checkout', order: 'Order placed / order page', payfail: 'Payment failed', account: 'My Account', wishlist: 'Wishlist', track: 'Track order', gifting: 'Gifting', story: 'Our story', contact: 'Contact', faq: 'FAQ', policy: 'Policies', seo: 'Product info pages (Google)' };
  const sum = (days, k) => days.reduce((a, d) => a + (Number(d[k]) || 0), 0);
  const sumMap = (days, k) => { const o = {}; days.forEach(d => Object.entries(d[k] || {}).forEach(([x, n]) => { o[x] = (o[x] || 0) + (Number(n) || 0); })); return Object.entries(o).sort((a, b) => b[1] - a[1]); };
  const pct = (a, b) => b ? Math.round((a / b) * 100) : 0;
  const pname = id => { const p = (window.APAR_DATA && (window.APAR_DATA.ALL_PRODUCTS || window.APAR_DATA.PRODUCTS) || []).find(x => x.id === id); return p ? p.name : id; };

  const Rows = ({ rows, label, total }) => html`<div className="vz-rows">${rows.length ? rows.map(([k, n]) => html`<div className="vz-row" key=${k}><span className="vz-l">${label ? label(k) : k}</span><span className="vz-bar"><i style=${{ width: Math.max(3, pct(n, total || rows[0][1])) + '%' }}></i></span><b className="mono">${n.toLocaleString('en-IN')}</b></div>`) : html`<p className="sub" style=${{ margin: 0 }}>No data yet.</p>`}</div>`;

  A.Visitors = function ({ data }) {
    const [range, setRange] = useState(7), [res, setRes] = useState(null), [err, setErr] = useState('');
    useEffect(() => { let on = true; setErr(''); A.api('stats?days=' + range, null, 'GET').then(r => on && setRes(r)).catch(e => on && setErr(e.message)); return () => { on = false; }; }, [range]);
    const days = (res && res.days) || [];
    const from = days.length ? days[0].date : '';
    const orders = (data.orders || []).filter(o => o.ts && A.dayKey(o.ts) >= from);
    const v = useMemo(() => ({
      visitors: sum(days, 'visitors'), visits: sum(days, 'visits'), pv: sum(days, 'pv'), prod: sum(days, 'prodViews'), cart: sum(days, 'cart'), cartViews: sum(days, 'cartViews'),
      checkout: sum(days, 'checkout'), wa: sum(days, 'wa'), calls: sum(days, 'calls')
    }), [res]);
    const steps = [['Visited the website', v.visits], ['Opened a product', v.prod ? Math.min(v.prod, v.visits) : 0], ['Added to cart', Math.min(v.cart, v.visits)], ['Started checkout', Math.min(v.checkout, v.visits)], ['Placed an order', orders.length]];
    const chart = days.map(d => ({ label: d.date.slice(8) + '/' + d.date.slice(5, 7), value: Number(d.visitors) || 0 }));
    const prodV = sumMap(days, 'prodView'), prodC = Object.fromEntries(sumMap(days, 'cartAdd'));
    return html`<div className="page">
      <div className="page-h"><div><h1>Website visitors</h1><p className="muted">How many people came to aparfragrances.com, where they came from, and how many went on to buy. Counted anonymously: no names, numbers or cookies.</p></div>
        <div className="row gap8"><${Tabs} value=${range} onChange=${setRange} items=${[[1, 'Today'], [7, '7 days'], [30, '30 days'], [90, '90 days']]} /></div></div>
      ${err && html`<div className="alert">${err}</div>`}
      ${!res && !err && html`<p className="sub">Loading…</p>`}
      ${res && html`<div className="stack" style=${{ gap: 18 }}>
        <div className="stats">
          <${Stat} label="Visitors" value=${v.visitors.toLocaleString('en-IN')} sub=${'people (unique per day)'} />
          <${Stat} label="Visits" value=${v.visits.toLocaleString('en-IN')} sub="times the site was opened" />
          <${Stat} label="Pages viewed" value=${v.pv.toLocaleString('en-IN')} sub=${v.visits ? (v.pv / v.visits).toFixed(1) + ' pages per visit' : ''} />
          <${Stat} label="Added to cart" value=${v.cart.toLocaleString('en-IN')} sub=${pct(Math.min(v.cart, v.visits), v.visits) + '% of visits'} />
          <${Stat} label="Orders" value=${orders.length} sub=${pct(orders.length, v.visits) + '% of visits bought'} tone=${orders.length ? 'green' : ''} />
          <${Stat} label="WhatsApp / call clicks" value=${v.wa + v.calls} sub=${v.wa + ' WhatsApp · ' + v.calls + ' calls'} />
        </div>
        <${Card} title="Who bought, who left (sales funnel)">
          <div className="vz-funnel">${steps.map(([label, n], i) => { const base = steps[0][1] || 1, prev = i ? steps[i - 1][1] : n, left = i ? Math.max(0, prev - n) : 0; return html`<div className="vz-step" key=${label}>
            <div className="vz-step-h"><b>${label}</b><span className="mono">${n.toLocaleString('en-IN')}</span></div>
            <div className="vz-step-bar"><i style=${{ width: Math.max(n ? 2 : 0, pct(n, base)) + '%' }}></i></div>
            <span className="sub">${i === 0 ? '100%' : pct(n, base) + '% of visits'}${i > 0 && left > 0 ? ' · ' + left.toLocaleString('en-IN') + ' did not go further' : ''}</span></div>`; })}</div>
          <p className="sub" style=${{ margin: '10px 0 0' }}>${v.visits ? (v.visits - orders.length).toLocaleString('en-IN') + ' of ' + v.visits.toLocaleString('en-IN') + ' visits left without ordering. People who chat on WhatsApp may still order there.' : 'Numbers start from the day this counter was switched on.'}</p>
        </${Card}>
        ${range > 1 && html`<${Card} title="Visitors per day"><${A.Bars} data=${chart} height=${150} /></${Card}>`}
        <div className="grid-2">
          <${Card} title="Where visitors came from"><${Rows} rows=${sumMap(days, 'src')} label=${k => SRC_LABEL[k] || k} /></${Card}>
          <${Card} title="Pages people opened"><${Rows} rows=${sumMap(days, 'pages')} label=${k => PAGE_LABEL[k] || k} /></${Card}>
          <${Card} title="Most viewed products">${prodV.length ? html`<div className="vz-rows">${prodV.slice(0, 15).map(([id, n]) => html`<div className="vz-row" key=${id}><span className="vz-l">${pname(id)}</span><span className="vz-bar"><i style=${{ width: Math.max(3, pct(n, prodV[0][1])) + '%' }}></i></span><b className="mono">${n}</b><span className="sub vz-c">${prodC[id] ? prodC[id] + ' to cart' : '0 to cart'}</span></div>`)}</div>` : html`<p className="sub" style=${{ margin: 0 }}>No product views yet.</p>`}</${Card}>
          <${Card} title="Mobile or computer"><${Rows} rows=${sumMap(days, 'dev')} label=${k => k === 'mobile' ? 'Mobile' : 'Computer'} /></${Card}>
        </div>
        <p className="sub" style=${{ margin: 0 }}>Tip: when you share the website link on Instagram or Facebook, add <span className="mono">?utm_source=instagram</span> (or facebook) at the end, so those visits are counted under the right platform.</p>
      </div>`}
    </div>`;
  };
})();
