// APAR Admin — shared UI components.
(function () {
  const A = window.AA;
  const { useState, useEffect, useRef } = React;
  const html = htm.bind(React.createElement);
  A.html = html;

  const cx = (...a) => a.filter(Boolean).join(' ');
  A.cx = cx;

  // ---------- icons (inline SVG, stroke style) ----------
  const P = {
    dash: 'M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z', orders: 'M6 2h12l2 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6zM4 6h16M9 10a3 3 0 0 0 6 0',
    box: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8', stock: 'M3 3v18h18M7 15l4-4 3 3 5-6', users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
    pay: 'M2 6h20v12H2zM2 10h20M6 15h4', tag: 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01', star: 'M12 2l3 6.9 7 .6-5.3 4.7 1.6 7.1L12 17.8 5.7 21.3l1.6-7.1L2 9.5l7-.6z',
    lead: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6', truck: 'M1 3h15v13H1zM16 8h4l3 3v5h-7zM5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3', bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0', x: 'M18 6 6 18M6 6l12 12',
    menu: 'M3 6h18M3 12h18M3 18h18', ext: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3', print: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
    plus: 'M12 5v14M5 12h14', dl: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3', wa: 'M7.9 20A9 9 0 1 0 4 16.1L2 22z', phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z',
    mail: 'M4 4h16v16H4zM22 6l-10 7L2 6', copy: 'M9 9h13v13H9zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1', map: 'M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    up: 'M12 19V5M5 12l7-7 7 7', down: 'M12 5v14M19 12l-7 7-7-7', left: 'M19 12H5M12 19l-7-7 7-7', right: 'M5 12h14M12 5l7 7-7 7', trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6', edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z',
    eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', eyeoff: 'M17.9 17.9A10 10 0 0 1 12 20c-7 0-11-8-11-8a18 18 0 0 1 5.1-5.9M9.9 4.2A9 9 0 0 1 12 4c7 0 11 8 11 8a18 18 0 0 1-2.2 3.2M1 1l22 22',
    check: 'M20 6 9 17l-5-5', alert: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9', store: 'M3 9l1-5h16l1 5M3 9h18v11H3zM9 20v-6h6v6'
  };
  A.Icon = ({ n, s = 18 }) => html`<svg width=${s} height=${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d=${P[n] || ''} /></svg>`;
  const Icon = A.Icon;

  A.Btn = ({ kind = 'ghost', icon, children, onClick, disabled, title, type = 'button', small, href, target }) => href
    ? html`<a className=${cx('btn', 'btn-' + kind, small && 'btn-sm')} href=${href} target=${target} rel="noopener" title=${title}>${icon && html`<${Icon} n=${icon} s=${small ? 15 : 17} />`}${children}</a>`
    : html`<button type=${type} className=${cx('btn', 'btn-' + kind, small && 'btn-sm')} onClick=${onClick} disabled=${disabled} title=${title}>${icon && html`<${Icon} n=${icon} s=${small ? 15 : 17} />`}${children}</button>`;
  const Btn = A.Btn;

  const STATUS_TONE = { Placed: 'blue', Packed: 'amber', Shipped: 'violet', 'Out for delivery': 'violet', Delivered: 'green', Cancelled: 'grey', Paid: 'green', 'COD pending': 'amber', Refunded: 'grey', Failed: 'red', Processing: 'amber', Live: 'green', Hidden: 'grey', Pending: 'amber', Published: 'green', New: 'blue', Contacted: 'amber', Quoted: 'violet', Won: 'green', Lost: 'grey', 'WhatsApp sent': 'violet', 'No answer': 'amber', 'Call back': 'amber', Interested: 'green', 'Sample sent': 'green', 'Wrong number': 'red', Requested: 'amber', Approved: 'green', 'Picked up': 'violet', Rejected: 'grey', 'Low stock': 'amber', 'Out of stock': 'red', 'In stock': 'green', Active: 'green', Paused: 'grey', Expired: 'grey', 'Used up': 'grey' };
  A.Badge = ({ t, tone }) => t ? html`<span className=${'badge tone-' + (tone || STATUS_TONE[t] || 'grey')}>${t}</span>` : null;

  A.Card = ({ title, actions, children, pad = true, className }) => html`<section className=${cx('card', className)}>${(title || actions) && html`<header className="card-h"><h3>${title}</h3><div className="row gap8">${actions}</div></header>`}<div className=${pad ? 'card-b' : ''}>${children}</div></section>`;

  A.Field = ({ label, hint, children, wide }) => html`<label className=${cx('field', wide && 'wide')}><span className="lbl">${label}</span>${children}${hint && html`<span className="hint">${hint}</span>`}</label>`;

  A.Empty = ({ icon = 'box', title, text, action }) => html`<div className="empty"><div className="empty-i"><${Icon} n=${icon} s=${28} /></div><div className="empty-t">${title}</div>${text && html`<p>${text}</p>`}${action}</div>`;

  A.Stat = ({ label, value, sub, tone, onClick }) => html`<button type="button" className=${cx('stat', tone && 'stat-' + tone)} onClick=${onClick} disabled=${!onClick}><span className="stat-l">${label}</span><span className="stat-v">${value}</span>${sub && html`<span className="stat-s">${sub}</span>`}</button>`;

  A.Tabs = ({ items, value, onChange }) => html`<div className="tabs" role="tablist">${items.map(([k, label, n]) => html`<button key=${k} type="button" role="tab" aria-selected=${value === k} className=${cx('tab', value === k && 'on')} onClick=${() => onChange(k)}>${label}${n != null && html`<span className="tab-n">${n}</span>`}</button>`)}</div>`;

  A.Drawer = ({ open, onClose, title, sub, children, footer, wide }) => {
    useEffect(() => { if (!open) return; const k = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [open]);
    if (!open) return null;
    return html`<div className="overlay" onMouseDown=${e => e.target === e.currentTarget && onClose()}><aside className=${cx('drawer', wide && 'drawer-wide')} role="dialog" aria-modal="true"><header className="drawer-h"><div><h2>${title}</h2>${sub && html`<div className="drawer-sub">${sub}</div>`}</div><button className="icon-btn" onClick=${onClose} aria-label="Close"><${Icon} n="x" /></button></header><div className="drawer-b">${children}</div>${footer && html`<footer className="drawer-f">${footer}</footer>`}</aside></div>`;
  };

  A.Modal = ({ open, onClose, title, children, footer }) => {
    if (!open) return null;
    return html`<div className="overlay center" onMouseDown=${e => e.target === e.currentTarget && onClose()}><div className="modal" role="dialog" aria-modal="true"><header className="drawer-h"><h2>${title}</h2><button className="icon-btn" onClick=${onClose} aria-label="Close"><${Icon} n="x" /></button></header><div className="modal-b">${children}</div>${footer && html`<footer className="drawer-f">${footer}</footer>`}</div></div>`;
  };

  // Confirm dialog without browser pop-ups: A.confirm({title, text, ok}) → Promise<boolean>
  let confirmSetter = null;
  A.ConfirmHost = () => {
    const [c, setC] = useState(null);
    confirmSetter = setC;
    if (!c) return null;
    const done = v => { setC(null); c.resolve(v); };
    return html`<${A.Modal} open=${true} onClose=${() => done(false)} title=${c.title} footer=${html`<${Btn} onClick=${() => done(false)}>Cancel</${Btn}><${Btn} kind=${c.danger ? 'danger' : 'primary'} onClick=${() => done(true)}>${c.ok || 'Confirm'}</${Btn}>`}><p className="muted">${c.text}</p></${A.Modal}>`;
  };
  A.confirm = o => new Promise(resolve => confirmSetter ? confirmSetter(Object.assign({}, o, { resolve })) : resolve(false));

  // Prompt dialog with fields: A.ask({title, fields:[{k,label,type,options,value}], ok}) → Promise<values|null>
  let askSetter = null;
  A.AskHost = () => {
    const [c, setC] = useState(null); const [v, setV] = useState({});
    askSetter = o => { setV(Object.fromEntries(o.fields.map(f => [f.k, f.value || (f.options ? f.options[0] : '')]))); setC(o); };
    if (!c) return null;
    const done = r => { setC(null); c.resolve(r); };
    return html`<${A.Modal} open=${true} onClose=${() => done(null)} title=${c.title} footer=${html`<${Btn} onClick=${() => done(null)}>Cancel</${Btn}><${Btn} kind="primary" onClick=${() => done(v)}>${c.ok || 'Save'}</${Btn}>`}>
      ${c.text && html`<p className="muted" style=${{ marginTop: 0 }}>${c.text}</p>`}
      <div className="form-grid">${c.fields.map(f => html`<${A.Field} key=${f.k} label=${f.label} wide=${true}>${f.options
        ? html`<select value=${v[f.k]} onChange=${e => setV(Object.assign({}, v, { [f.k]: e.target.value }))}>${f.options.map(o => html`<option key=${o} value=${o}>${o}</option>`)}</select>`
        : html`<input type=${f.type || 'text'} value=${v[f.k]} placeholder=${f.ph || ''} onChange=${e => setV(Object.assign({}, v, { [f.k]: e.target.value }))} />`}</${A.Field}>`)}</div></${A.Modal}>`;
  };
  A.ask = o => new Promise(resolve => askSetter ? askSetter(Object.assign({}, o, { resolve })) : resolve(null));

  // Toasts
  let toastPush = null;
  A.ToastHost = () => {
    const [list, setList] = useState([]);
    toastPush = (msg, tone) => { const id = Math.random(); setList(l => [...l, { id, msg, tone }]); setTimeout(() => setList(l => l.filter(x => x.id !== id)), tone === 'error' ? 6000 : 3200); };
    return html`<div className="toasts" aria-live="polite">${list.map(t => html`<div key=${t.id} className=${cx('toast', t.tone && 'toast-' + t.tone)}>${t.msg}</div>`)}</div>`;
  };
  A.toast = (msg, tone) => toastPush && toastPush(msg, tone);
  // Run a promise with a busy state and success/error toast.
  A.run = async (p, ok) => { try { const r = await p; if (ok) A.toast(ok, 'ok'); return r; } catch (e) { A.toast(e.message || String(e), 'error'); throw e; } };

  A.copy = (text, label) => { try { navigator.clipboard.writeText(text); A.toast((label || 'Copied') + ' copied', 'ok'); } catch (e) { A.toast('Could not copy', 'error'); } };

  // Simple bar chart (SVG) — data: [{label, value}]
  A.Bars = ({ data, height = 180, money }) => {
    const max = Math.max(1, ...data.map(d => d.value));
    const w = 100 / Math.max(1, data.length);
    const [hover, setHover] = useState(-1);
    return html`<div className="bars"><svg viewBox=${'0 0 100 ' + height} preserveAspectRatio="none" style=${{ width: '100%', height }}>
      ${[0.25, 0.5, 0.75].map(f => html`<line key=${f} x1="0" x2="100" y1=${height * f} y2=${height * f} stroke="var(--line)" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />`)}
      ${data.map((d, i) => { const h = Math.max(d.value ? 2 : 0, (d.value / max) * (height - 8)); return html`<rect key=${i} x=${i * w + w * 0.18} width=${w * 0.64} y=${height - h} height=${h} rx="0.6" fill=${hover === i ? 'var(--gold)' : 'var(--green)'} onMouseEnter=${() => setHover(i)} onMouseLeave=${() => setHover(-1)} />`; })}
    </svg><div className="bars-x"><span>${data[0] && data[0].label}</span><span>${hover >= 0 ? data[hover].label + ': ' + (money ? A.inr(data[hover].value) : data[hover].value) : 'Hover a bar for details'}</span><span>${data.length && data[data.length - 1].label}</span></div></div>`;
  };

  // Pagination helper hook for long tables
  A.usePage = (rows, size = 50) => {
    const [n, setN] = useState(1);
    useEffect(() => setN(1), [rows.length]);
    const pages = Math.max(1, Math.ceil(rows.length / size));
    return { rows: rows.slice((n - 1) * size, n * size), pager: pages > 1 ? html`<div className="pager"><${Btn} small onClick=${() => setN(Math.max(1, n - 1))} disabled=${n === 1}>Previous</${Btn}><span className="muted">Page ${n} of ${pages} · ${rows.length} rows</span><${Btn} small onClick=${() => setN(Math.min(pages, n + 1))} disabled=${n === pages}>Next</${Btn}></div>` : null };
  };

  A.useHash = () => {
    const get = () => (location.hash || '#/').replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    const [h, setH] = useState(get());
    useEffect(() => { const f = () => setH(get()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
    return h;
  };
  A.go = path => { location.hash = '#/' + path; };

  // Live-editable input that saves on blur/Enter only when value changed
  A.SaveInput = ({ value, onSave, type = 'text', width, placeholder }) => {
    const [v, setV] = useState(value == null ? '' : String(value));
    useEffect(() => setV(value == null ? '' : String(value)), [value]);
    const commit = () => { if (String(value == null ? '' : value) !== v) onSave(v); };
    return html`<input className="inline-in" type=${type} value=${v} placeholder=${placeholder} style=${{ width }} onChange=${e => setV(e.target.value)} onBlur=${commit} onKeyDown=${e => e.key === 'Enter' && e.target.blur()} />`;
  };
})();
