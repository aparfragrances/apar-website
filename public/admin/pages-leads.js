// APAR Admin — Lead Desk (B2B leads): website enquiries + researched prospects,
// call log, follow-ups, one-click WhatsApp, Excel/CSV upload and insights.
(function () {
  const A = window.AA;
  const { useState, useEffect, useMemo } = React;
  const { html, Btn, Badge, Card, Field, Empty, Tabs, Drawer, Icon, Stat, cx } = A;

  // ---------- statuses ----------
  const ST = ['New', 'WhatsApp sent', 'No answer', 'Call back', 'Interested', 'Sample sent', 'Quoted', 'Won', 'Lost', 'Wrong number'];
  const ST_LABEL = { New: 'Not contacted', Quoted: 'Negotiating / quoted', Won: 'Order won', Lost: 'Not interested' };
  const OUTCOMES = ['No answer', 'Call back', 'Interested', 'Sample sent', 'Quoted', 'Won', 'Lost', 'Wrong number'];
  const CLOSED = new Set(['Won', 'Lost', 'Wrong number']);
  const WARM = new Set(['Interested', 'Sample sent', 'Quoted', 'Won']);
  const statusOf = l => l.status || 'New';
  const contacted = l => statusOf(l) !== 'New';
  const PRODUCTS = ['Gulkand', 'Karonda Cherry', 'Tutti Frutti', 'Laccha Tutti Frutti', 'Laccha Supari', 'Mukhwas'];
  const CATS = ['Bakery', 'Sweet Shop', 'Ice Cream & Desserts', 'Hotel', 'Restaurant', 'Cafe', 'Paan & Mukhwas', 'Caterer', 'Wholesaler'];
  const DEFAULT_TPLS = [
    { id: 'intro', name: 'First intro (Hinglish)', text: 'Namaste {name} ji 🙏\n\nMain APAR, Jaipur se baat kar raha hoon. Hum gulkand, karonda cherry, tutti frutti aur mukhwas banate hain — hotels, bakeries aur sweet shops ke liye wholesale.\n\nAapke {category} ke liye hamara {products} bahut accha rahega. Kya hum aapko free sample aur wholesale rate list bhej sakte hain?\n\nhttps://aparfragrances.com/wholesale/' },
    { id: 'intro-en', name: 'First intro (English)', text: 'Hello {name} team,\n\nThis is APAR from Jaipur. We manufacture gulkand, karonda cherry, tutti frutti, laccha tutti frutti and mukhwas for hotels, restaurants, bakeries and sweet shops across Rajasthan.\n\nFor a {category} in {city}, our {products} could be a great fit. May we send a free sample and our wholesale price list?\n\nhttps://aparfragrances.com/wholesale/' },
    { id: 'followup', name: 'Follow-up after sample', text: 'Namaste {name} ji,\n\nAPAR se — humne jo {products} ka sample bheja tha, kaisa laga? Aap jo quantity regularly use karte hain, uske hisaab se best rate de denge. Bulk order par Jaipur mein free delivery.\n\nKab baat kar sakte hain?' }
  ];

  // ---------- lead helpers (website enquiries and prospects share one shape) ----------
  const biz = l => l.company || l.name || '(no name)';
  const person = l => l.company && l.name ? l.name : '';
  const city = l => l.location || '';
  const prio = l => l.priority || (l.type && l.type !== 'Prospect' ? 'A' : 'C');
  const prods = l => String(l.products || l.product || '').split(/[;,]\s*/).map(s => s.trim()).filter(Boolean);
  const isWeb = l => !l.type || l.type !== 'Prospect';
  const digits = p => String(p || '').replace(/\D/g, '');
  const mobile10 = p => { let d = digits(p); if (d.length === 12 && d.startsWith('91')) d = d.slice(2); return /^[6-9]\d{9}$/.test(d) ? d : null; };
  const waNum = l => l.relay ? null : (mobile10(l.phone) || mobile10(l.phone2));
  const isPhone = () => /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const waLink = (n, text) => (isPhone() ? 'https://wa.me/91' + n + '?text=' : 'https://web.whatsapp.com/send?phone=91' + n + '&text=') + encodeURIComponent(text);
  const fill = (t, l) => String(t || '').replace(/\{name\}/g, person(l) || biz(l)).replace(/\{city\}/g, city(l) || 'your city')
    .replace(/\{products\}/g, prods(l).slice(0, 3).join(', ') || 'gulkand and tutti frutti').replace(/\{category\}/g, (l.category || 'business').toLowerCase());
  const dayOf = ts => ts ? A.dayKey(ts) : '';
  const when = ts => ts ? new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '';
  const who = e => String(e || 'Team').split('@')[0];
  const addDays = n => new Date(Date.now() + n * 864e5).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  const Prio = ({ p }) => html`<span className=${'ld-prio ld-prio-' + p} title=${'Priority ' + p}>${p}</span>`;
  const Status = ({ s }) => html`<${Badge} t=${ST_LABEL[s] || s} tone=${{ New: 'blue', 'WhatsApp sent': 'violet', 'No answer': 'amber', 'Call back': 'amber', Contacted: 'amber', Interested: 'green', 'Sample sent': 'green', Quoted: 'violet', Won: 'green', Lost: 'grey', 'Wrong number': 'red' }[s] || 'grey'} />`;

  // Horizontal stacked bars: rows [label, [warm, contacted, notYet]]
  const HBars = ({ rows, colors, limit }) => {
    const r = rows.slice(0, limit || 99), max = Math.max(1, ...r.map(x => x[1].reduce((a, b) => a + b, 0)));
    return html`<div className="ld-hbars">${r.map(([label, parts]) => { const tot = parts.reduce((a, b) => a + b, 0); return html`<div className="ld-hbar" key=${label}><span className="ld-hbar-l" title=${label}>${label}</span><span className="ld-hbar-t">${parts.map((v, i) => v ? html`<i key=${i} style=${{ width: (v / max * 100) + '%', background: colors[i] }}></i>` : null)}</span><span className="ld-hbar-v">${tot}</span></div>`; })}</div>`;
  };
  const stackBy = (leads, key) => {
    const g = {};
    leads.forEach(l => { const k = key(l) || '—'; g[k] = g[k] || [0, 0, 0]; const s = statusOf(l); g[k][WARM.has(s) ? 0 : s !== 'New' ? 1 : 2]++; });
    return Object.entries(g).sort((a, b) => b[1].reduce((x, y) => x + y, 0) - a[1].reduce((x, y) => x + y, 0));
  };
  const STACK_COLORS = ['var(--green)', 'var(--gold)', 'var(--line)'];
  const Legend = () => html`<div className="ld-legend"><span><i style=${{ background: 'var(--green)' }}></i>Interested or better</span><span><i style=${{ background: 'var(--gold)' }}></i>Contacted</span><span><i style=${{ background: 'var(--line)' }}></i>Not yet</span></div>`;

  // ---------- file upload helpers ----------
  const COLS = [['name', 'Business name', /^(name|business|shop|firm|company|party|outlet|customer|client|hotel|restaurant)/i],
    ['phone', 'Phone', /^(phone|mobile|mob|contact ?no|number|cell|whatsapp|ph\.?\s*no)/i], ['phone2', 'Second phone', /(alt|alternate|phone ?2|mobile ?2|other)/i],
    ['city', 'City', /^(city|town|district|location)/i], ['area', 'Area / address', /(area|locality|address|colony|sector)/i],
    ['category', 'Category', /(category|type|segment)/i], ['status', 'Status', /(status|stage|result|outcome|response|disposition)/i],
    ['notes', 'Notes / remarks', /(note|remark|comment|feedback|discussion)/i], ['follow', 'Follow-up date', /(follow|next|callback date|due)/i],
    ['products', 'Products', /(product|item|requirement)/i], ['contact', 'Contact person', /(person|owner|contact name|manager|proprietor)/i],
    ['priority', 'Priority', /^prio/i], ['why', 'Why it fits', /(why|fit|insight)/i], ['size', 'Size', /^size/i], ['relay', 'Directory line', /(directory|relay)/i], ['source', 'Source link', /(source|url|link)/i]];
  function mapStatus(s) {
    s = String(s || '').toLowerCase().trim(); if (!s) return 'New';
    const R = [[/not ?interest|no need|not required|reject|declin/, 'Lost'], [/wrong|invalid|not exist|incorrect/, 'Wrong number'], [/order|won|convert|closed|purchas|deal done/, 'Won'],
      [/sample/, 'Sample sent'], [/negot|rate|price|quotation|quote/, 'Quoted'], [/interest|positive|hot|warm/, 'Interested'], [/call ?back|follow|later|busy now|meeting/, 'Call back'],
      [/no ?answer|not ?pick|\bnr\b|ringing|switch|not reachable|busy|unanswer/, 'No answer'], [/whats ?app|msg|message sent/, 'WhatsApp sent'], [/new|fresh|pending|not called|to call/, 'New']];
    for (const [re, k] of R) if (re.test(s)) return k; return 'Call back';
  }
  function mapCat(c) {
    c = String(c || '').toLowerCase(); if (CATS.map(x => x.toLowerCase()).includes(c)) return CATS.find(x => x.toLowerCase() === c);
    const R = [[/bak|cake/, 'Bakery'], [/sweet|mithai|misthan|namkeen|halwai/, 'Sweet Shop'], [/ice|kulfi|dessert|falooda|rabri/, 'Ice Cream & Desserts'], [/hotel|resort|guest|lodge|palace|haveli/, 'Hotel'], [/cafe|café|coffee/, 'Cafe'],
      [/paan|pan |mukhwas|supari/, 'Paan & Mukhwas'], [/cater|banquet|garden|venue|wedding/, 'Caterer'], [/whole|distrib|trader|kirana|dry ?fruit|dealer|store|mart/, 'Wholesaler'], [/restau|dhaba|bhojnal|thali|food|kitchen/, 'Restaurant']];
    for (const [re, k] of R) if (re.test(c)) return k; return c ? 'Restaurant' : '';
  }
  function mapProducts(s) {
    const out = [];
    String(s || '').toLowerCase().split(/[;,|/]+/).map(x => x.trim()).forEach(t => {
      let p = PRODUCTS.find(P => P.toLowerCase() === t);
      if (!p) p = /lac+ha.*tutti/.test(t) ? 'Laccha Tutti Frutti' : /tutti|tooty/.test(t) ? 'Tutti Frutti' : /cherry|karonda/.test(t) ? 'Karonda Cherry' : /supari/.test(t) ? 'Laccha Supari' : /gulkand|rose/.test(t) ? 'Gulkand' : /mukhwas|saunf|mouth/.test(t) ? 'Mukhwas' : null;
      if (p && !out.includes(p)) out.push(p);
    });
    return out.join('; ');
  }
  function toDate(v) {
    if (!v) return ''; if (v instanceof Date && !isNaN(v)) return v.toLocaleDateString('en-CA');
    if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10);
    const s = String(v).trim(), m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (m) return (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '';
  }
  let xlsxP = null;
  const loadXLSX = () => xlsxP || (xlsxP = new Promise((res, rej) => { if (window.XLSX) return res(window.XLSX); const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = () => res(window.XLSX); s.onerror = () => { xlsxP = null; rej(new Error('Could not load the Excel reader. Check your internet and try again.')); }; document.head.appendChild(s); }));
  const key10 = p => { const d = digits(p); return d.length >= 10 ? d.slice(-10) : ''; };

  // ---------- Upload drawer ----------
  function Upload({ leads, onClose }) {
    const [f, setF] = useState(null), [busy, setBusy] = useState(false), [mode, setMode] = useState('update'), [done, setDone] = useState(null), [prog, setProg] = useState(0);
    const read = async file => {
      try {
        const X = await loadXLSX();
        const wb = X.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
        const rows = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false, dateNF: 'yyyy-mm-dd' });
        if (!rows.length) throw new Error('That file has no rows under the heading row.');
        const headers = Object.keys(rows[0]), map = {};
        COLS.forEach(([k, , re]) => { const h = headers.find(h => re.test(h.trim()) && !Object.values(map).includes(h)); if (h) map[k] = h; });
        setF({ name: file.name, rows, headers, map });
      } catch (e) { A.toast(e.message || 'Could not read that file. Save it as .xlsx or .csv and try again.', 'error'); }
    };
    const mapped = useMemo(() => {
      if (!f) return [];
      const g = (r, k) => f.map[k] ? String(r[f.map[k]] == null ? '' : r[f.map[k]]).trim() : '';
      return f.rows.map(r => ({
        name: g(r, 'name'), phone: g(r, 'phone'), phone2: g(r, 'phone2'), city: g(r, 'city') || 'Jaipur', area: g(r, 'area'), category: mapCat(g(r, 'category')),
        status: mapStatus(g(r, 'status')), raw: g(r, 'status'), notes: g(r, 'notes'), follow: f.map.follow ? toDate(r[f.map.follow]) : '', products: mapProducts(g(r, 'products')),
        contact: g(r, 'contact'), priority: /^[ABC]$/i.test(g(r, 'priority')) ? g(r, 'priority').toUpperCase() : 'B', why: g(r, 'why'), size: g(r, 'size'),
        relay: /^y/i.test(g(r, 'relay')), source: g(r, 'source') || 'Upload: ' + f.name
      })).filter(r => r.name || r.phone);
    }, [f]);
    const known = useMemo(() => { const s = new Set(); leads.forEach(l => { if (!l.relay) [l.phone, l.phone2].forEach(p => { const k = key10(p); if (k) s.add(k); }); }); return s; }, [leads]);
    const dup = mapped.filter(r => !r.relay && known.has(key10(r.phone))).length;
    const go = async () => {
      setBusy(true); const tot = { added: 0, updated: 0, skipped: 0 }; let err = '';
      for (let i = 0; i < mapped.length; i += 400) {
        try { const r = await A.importLeads(mapped.slice(i, i + 400).map(({ raw, ...x }) => x), mode); tot.added += r.added; tot.updated += r.updated; tot.skipped += r.skipped; }
        catch (e) { err = e.message; break; }
        setProg(Math.min(mapped.length, i + 400) / mapped.length);
      }
      setBusy(false); setDone({ ...tot, err });
    };
    const body = done ? html`<div className="stack" style=${{ gap: 12 }}><div className=${done.err ? 'alert' : 'ok-msg'}>${done.err ? 'Import stopped: ' + done.err + ' Upload the same file again; rows already added are skipped.' : 'Import finished.'}</div>
        <div className="kvs"><div><span>Added</span>${done.added}</div><div><span>Updated</span>${done.updated}</div><div><span>Skipped</span>${done.skipped}</div></div><p className="sub">New leads appear in the list within a few seconds.</p></div>`
      : !f ? html`<label className="drop"><${Icon} n="up" s=${26} /><b>Choose an Excel or CSV file</b><span className="sub">First row = column headings. Name, Phone, City, Area, Category, Status, Remarks, Follow-up are picked up automatically.</span><input type="file" accept=".xlsx,.xls,.csv" hidden onChange=${e => e.target.files[0] && read(e.target.files[0])} /></label>`
      : html`<div className="stack" style=${{ gap: 14 }}>
        <div className="alert grey"><b>${f.name}</b> · ${mapped.length} rows · ${mapped.filter(r => key10(r.phone)).length} with a phone · ${dup} already in the list (matched by phone)</div>
        <${Card} title="Match your columns"><div className="ld-map">${COLS.map(([k, label]) => html`<label key=${k}><span>${label}</span><select value=${f.map[k] || ''} onChange=${e => setF({ ...f, map: { ...f.map, [k]: e.target.value } })}><option value="">— not in file —</option>${f.headers.map(h => html`<option key=${h} value=${h}>${h}</option>`)}</select></label>`)}</div></${Card}>
        <${Card} title="Preview (first 5)" pad=${false}><div className="tbl-wrap"><table className="tbl"><thead><tr><th>Business</th><th>Phone</th><th>City / area</th><th>Status</th></tr></thead><tbody>${mapped.slice(0, 5).map((r, i) => html`<tr key=${i}><td>${r.name}</td><td className="mono">${r.phone}</td><td>${r.city}${r.area ? ' · ' + r.area : ''}</td><td><${Status} s=${r.status} />${r.raw ? html` <span className="sub">“${r.raw}”</span>` : ''}</td></tr>`)}</tbody></table></div></${Card}>
        <${Field} label="If a business is already in the list"><select value=${mode} onChange=${e => setMode(e.target.value)}><option value="update">Update its status and notes from my file</option><option value="skip">Skip it</option></select></${Field}>
        ${busy && html`<div className="ld-prog"><i style=${{ width: (prog * 100) + '%' }}></i></div>`}</div>`;
    return html`<${Drawer} open=${true} wide=${true} onClose=${onClose} title="Upload leads" sub="Excel (.xlsx, .xls) or CSV"
      footer=${done ? html`<${Btn} kind="primary" onClick=${onClose}>Done</${Btn}>` : f ? html`<${Btn} onClick=${() => setF(null)} disabled=${busy}>Choose another file</${Btn}><${Btn} kind="primary" disabled=${busy || !mapped.length} onClick=${go}>${busy ? 'Importing…' : 'Import ' + mapped.length + ' rows'}</${Btn}>` : null}>${body}</${Drawer}>`;
  }

  // ---------- Add one lead ----------
  async function addOne() {
    const v = await A.ask({
      title: 'Add a business', ok: 'Add', fields: [{ k: 'name', label: 'Business name' }, { k: 'phone', label: 'Phone', type: 'tel', ph: '98290 12345' }, { k: 'city', label: 'City', value: 'Jaipur' },
        { k: 'area', label: 'Area' }, { k: 'category', label: 'Category', options: CATS }, { k: 'priority', label: 'Priority', options: ['A', 'B', 'C'], value: 'B' }, { k: 'products', label: 'Products that fit', ph: 'Gulkand; Tutti Frutti' }, { k: 'notes', label: 'Notes' }]
    });
    if (!v) return;
    if (!v.name && !v.phone) return A.toast('Enter the business name or phone.', 'error');
    await A.run(A.addLead({ ...v, products: mapProducts(v.products) || v.products }), 'Business added');
  }

  // ---------- Lead drawer: update status ----------
  function LeadDrawer({ l, tpl, onClose }) {
    const [pick, setPick] = useState(null), [note, setNote] = useState(''), [follow, setFollow] = useState(l.follow || ''), [value, setValue] = useState(l.value || ''), [busy, setBusy] = useState(false);
    const wa = waNum(l), hist = (l.log || []).slice().sort((a, b) => b.t - a.t);
    const save = async () => {
      if (!pick) return A.toast('Pick what happened first.', 'error');
      setBusy(true);
      try { await A.run(A.logLead(l, { type: 'call', status: pick, note: note.trim(), follow, value }), 'Status saved'); onClose(); } catch (e) { setBusy(false); }
    };
    return html`<${Drawer} open=${true} onClose=${onClose} title=${biz(l)} sub=${[l.category || l.type, city(l), l.area].filter(Boolean).join(' · ')}
      footer=${html`${wa && html`<${Btn} kind="ghost" icon="wa" href=${waLink(wa, fill(tpl.text, l))} target="_blank">WhatsApp</${Btn}>`}<${Btn} kind="primary" disabled=${busy} onClick=${save}>${busy ? 'Saving…' : 'Save status'}</${Btn}>`}>
      <div className="stack" style=${{ gap: 14 }}>
        <div className="row gap8 wrap">${l.phone ? html`<${Btn} small icon="phone" href=${'tel:' + digits(l.phone)}>${l.phone}</${Btn}><${Btn} small icon="copy" onClick=${() => A.copy(digits(l.phone), 'Number')}>Copy</${Btn}>` : html`<span className="sub">No phone number found</span>`}${l.phone2 && html`<${Btn} small icon="phone" href=${'tel:' + digits(l.phone2)}>${l.phone2}</${Btn}>`}${l.email && html`<${Btn} small icon="mail" href=${'mailto:' + l.email}>Email</${Btn}>`}</div>
        ${l.relay && html`<div className="alert grey">This is a directory relay line. Ask for the owner or the purchase person and save their direct number in the notes.</div>`}
        <div className="kvs"><div><span>Status</span><${Status} s=${statusOf(l)} /></div><div><span>Priority</span><${Prio} p=${prio(l)} /></div><div><span>Products</span>${prods(l).join(', ') || '—'}</div><div><span>Source</span>${isWeb(l) ? 'Website enquiry' : l.source && /^https?:/.test(l.source) ? html`<a href=${l.source} target="_blank" rel="noopener">Where we found it</a>` : l.source || 'Research'}</div>
          ${l.quantity && html`<div><span>Quantity</span>${l.quantity}</div>`}${l.gstin && html`<div><span>GSTIN</span>${l.gstin}</div>`}${person(l) && html`<div><span>Contact</span>${person(l)}</div>`}${l.owner && html`<div><span>Owner</span>${l.owner}</div>`}</div>
        ${(l.why || l.message) && html`<p className="sub" style=${{ margin: 0, lineHeight: 1.6 }}>${l.message || l.why}</p>`}
        <${Field} label="What happened?"><div className="ld-outcomes">${OUTCOMES.map(s => html`<button key=${s} type="button" className=${cx('ld-out', pick === s && 'on')} onClick=${() => setPick(s)}>${ST_LABEL[s] || s}</button>`)}</div></${Field}>
        <${Field} label="What did they say?"><textarea rows="3" value=${note} onChange=${e => setNote(e.target.value)} placeholder="e.g. Uses 20 kg tutti frutti a month, wants rate for 5 kg pack"></textarea></${Field}>
        <div className="form-grid"><${Field} label="Next follow-up"><input type="date" value=${follow} onChange=${e => setFollow(e.target.value)} /></${Field}>
          <${Field} label="Order value ₹ (if won)"><input type="number" min="0" value=${value} onChange=${e => setValue(e.target.value)} /></${Field}></div>
        <div className="row gap8 wrap">${[['Tomorrow', 1], ['In 3 days', 3], ['Next week', 7]].map(([t, n]) => html`<${Btn} key=${t} small onClick=${() => setFollow(addDays(n))}>${t}</${Btn}>`)}</div>
        <${Card} title="History">${hist.length ? html`<ul className="timeline">${hist.map((h, i) => html`<li key=${i}><span className="tl-dot"></span><div><div><${Status} s=${h.status} /> <span className="sub">${h.type === 'whatsapp' ? 'WhatsApp' : h.type === 'import' ? 'From upload' : 'Call'} · ${when(h.t)} · ${who(h.by)}</span></div>${h.note && html`<div style=${{ marginTop: 4 }}>${h.note}</div>`}</div></li>`)}</ul>` : html`<p className="sub" style=${{ margin: 0 }}>Nothing logged yet.${l.notes ? ' Notes: ' + l.notes : ''}</p>`}</${Card}>
      </div></${Drawer}>`;
  }

  // ---------- WhatsApp one-by-one ----------
  function Queue({ list, tpl, onClose }) {
    const [i, setI] = useState(0), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false), [sent, setSent] = useState(0);
    const l = list[i];
    useEffect(() => { if (l) setMsg(fill(tpl.text, l)); }, [i]);
    if (!l) return html`<${A.Modal} open=${true} onClose=${onClose} title="All done" footer=${html`<${Btn} kind="primary" onClick=${onClose}>Close</${Btn}>`}><p>${sent} of ${list.length} marked as sent. They now show “WhatsApp sent”.</p></${A.Modal}>`;
    const n = waNum(l);
    const next = async markSent => {
      if (markSent) { setBusy(true); try { const keep = statusOf(l) !== 'New' && statusOf(l) !== 'WhatsApp sent'; await A.logLead(l, { type: 'whatsapp', status: keep ? statusOf(l) : 'WhatsApp sent', note: 'WhatsApp: ' + tpl.name }); setSent(sent + 1); } catch (e) { A.toast(e.message, 'error'); } setBusy(false); }
      setI(i + 1);
    };
    return html`<${Drawer} open=${true} onClose=${onClose} title=${biz(l)} sub=${(i + 1) + ' of ' + list.length + ' · ' + (city(l) || '') + ' · +91 ' + n}
      footer=${html`<${Btn} onClick=${() => next(false)}>Skip</${Btn}><${Btn} icon="wa" href=${waLink(n, msg)} target="_blank">Open in WhatsApp</${Btn}><${Btn} kind="primary" disabled=${busy} onClick=${() => next(true)}>Sent — next</${Btn}>`}>
      <div className="stack" style=${{ gap: 12 }}><${Field} label="Message (edit before opening if you like)"><textarea rows="10" value=${msg} onChange=${e => setMsg(e.target.value)}></textarea></${Field}>
      <ol className="sub" style=${{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}><li>Click <b>Open in WhatsApp</b>: the chat opens in WhatsApp Web with this text.</li><li>Press Send there.</li><li>Come back and click <b>Sent — next</b>.</li></ol></div></${Drawer}>`;
  }

  // ---------- Main page ----------
  A.Leads = function ({ data, role }) {
    const all = data.leads || [];
    const [tab, setTab] = useState('list'), [q, setQ] = useState(''), [src, setSrc] = useState(''), [fc, setFc] = useState(''), [fa, setFa] = useState(''), [fk, setFk] = useState(''), [fp, setFp] = useState(''), [fs, setFs] = useState('open'), [fpr, setFpr] = useState(''), [fwa, setFwa] = useState(false), [sort, setSort] = useState('prio');
    const [open, setOpen] = useState(null), [up, setUp] = useState(false), [sel, setSel] = useState([]), [queue, setQueue] = useState(null), [tplId, setTplId] = useState('intro');
    const [tpls, setTpls] = useState(DEFAULT_TPLS);
    useEffect(() => A.db.doc('settings/leadTemplates').onSnapshot(s => { const x = s.exists && s.data().list; if (Array.isArray(x) && x.length) setTpls(x); }, () => { }), []);
    const tpl = tpls.find(t => t.id === tplId) || tpls[0];
    const today = A.todayISO();
    const cities = useMemo(() => [...new Set(all.map(city).filter(Boolean))].sort(), [all]);
    const areas = useMemo(() => [...new Set(all.filter(l => !fc || city(l) === fc).map(l => l.area).filter(Boolean))].sort(), [all, fc]);
    const rows = useMemo(() => {
      const t = q.trim().toLowerCase(), po = { A: 0, B: 1, C: 2 };
      const r = all.filter(l => (!src || (src === 'web' ? isWeb(l) : !isWeb(l))) && (!fc || city(l) === fc) && (!fa || l.area === fa) && (!fk || l.category === fk) && (!fp || prods(l).includes(fp))
        && (!fs || (fs === 'open' ? !CLOSED.has(statusOf(l)) : fs === 'due' ? (l.follow && l.follow <= today && !CLOSED.has(statusOf(l))) : statusOf(l) === fs)) && (!fpr || prio(l) === fpr) && (!fwa || waNum(l))
        && (!t || [biz(l), l.name, l.area, city(l), l.phone, l.why, l.notes, l.message].join(' ').toLowerCase().includes(t)));
      return r.sort(sort === 'name' ? (a, b) => biz(a).localeCompare(biz(b)) : sort === 'recent' ? (a, b) => (b.lastAt || 0) - (a.lastAt || 0) : sort === 'new' ? (a, b) => (b.ts || 0) - (a.ts || 0)
        : sort === 'city' ? (a, b) => city(a).localeCompare(city(b)) || String(a.area || '').localeCompare(String(b.area || '')) : (a, b) => (isWeb(b) && statusOf(b) === 'New') - (isWeb(a) && statusOf(a) === 'New') || po[prio(a)] - po[prio(b)] || biz(a).localeCompare(biz(b)));
    }, [all, q, src, fc, fa, fk, fp, fs, fpr, fwa, sort]);
    const pg = A.usePage(rows, 100);
    const l = open && all.find(x => x._id === open);
    const due = all.filter(x => x.follow && x.follow <= today && !CLOSED.has(statusOf(x)));
    const newWeb = all.filter(x => isWeb(x) && statusOf(x) === 'New').length;
    const toggle = id => setSel(sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]);
    const pageWa = pg.rows.filter(waNum).map(x => x._id), allPicked = pageWa.length > 0 && pageWa.every(id => sel.includes(id));
    const exportCsv = () => A.csv('APAR-Leads-' + today + '.csv', [['Business', 'Contact', 'Phone', 'Phone 2', 'City', 'Area', 'Category', 'Priority', 'Products', 'Status', 'Follow-up', 'Last contact', 'By', 'Owner', 'Notes', 'Order value', 'Source', 'Type', 'Date'],
      ...rows.map(x => [biz(x), person(x), x.phone, x.phone2, city(x), x.area, x.category, prio(x), prods(x).join('; '), statusOf(x), x.follow, when(x.lastAt), who(x.lastBy), x.owner, x.notes || x.message, x.value, isWeb(x) ? 'Website' : x.source, x.type, x.date])]);

    // ----- tab bodies -----
    let body;
    if (tab === 'list') body = html`
      <div className="filters"><div className="search"><${Icon} n="search" s=${16} /><input value=${q} onChange=${e => setQ(e.target.value)} placeholder="Search business, area, phone, notes…" aria-label="Search leads" /></div>
        <select className="sel" value=${src} onChange=${e => setSrc(e.target.value)} aria-label="Source"><option value="">All sources</option><option value="web">Website enquiries</option><option value="prospect">Researched / uploaded</option></select>
        <select className="sel" value=${fs} onChange=${e => setFs(e.target.value)} aria-label="Status"><option value="open">Open (not closed)</option><option value="due">Follow-up due</option><option value="">All statuses</option>${ST.map(s => html`<option key=${s} value=${s}>${ST_LABEL[s] || s}</option>`)}</select>
        <select className="sel" value=${fc} onChange=${e => { setFc(e.target.value); setFa(''); }} aria-label="City"><option value="">All cities</option>${cities.map(c => html`<option key=${c}>${c}</option>`)}</select>
        <select className="sel" value=${fa} onChange=${e => setFa(e.target.value)} aria-label="Area"><option value="">All areas</option>${areas.map(c => html`<option key=${c}>${c}</option>`)}</select>
        <select className="sel" value=${fk} onChange=${e => setFk(e.target.value)} aria-label="Category"><option value="">All categories</option>${CATS.map(c => html`<option key=${c}>${c}</option>`)}</select>
        <select className="sel" value=${fp} onChange=${e => setFp(e.target.value)} aria-label="Product"><option value="">All products</option>${PRODUCTS.map(c => html`<option key=${c}>${c}</option>`)}</select>
        <select className="sel" value=${fpr} onChange=${e => setFpr(e.target.value)} aria-label="Priority"><option value="">Any priority</option><option>A</option><option>B</option><option>C</option></select>
        <select className="sel" value=${sort} onChange=${e => setSort(e.target.value)} aria-label="Sort"><option value="prio">Sort: priority</option><option value="new">Sort: newest added</option><option value="recent">Sort: last contacted</option><option value="city">Sort: city & area</option><option value="name">Sort: name</option></select>
        <label className="check"><input type="checkbox" checked=${fwa} onChange=${e => setFwa(e.target.checked)} />WhatsApp only</label></div>
      ${sel.length > 0 && html`<div className="bulk"><b>${sel.length} selected</b><select className="sel" value=${tpl.id} onChange=${e => setTplId(e.target.value)} aria-label="Message template" style=${{ color: 'var(--ink)' }}>${tpls.map(t => html`<option key=${t.id} value=${t.id}>${t.name}</option>`)}</select>
        <${Btn} small icon="wa" onClick=${() => setQueue(all.filter(x => sel.includes(x._id) && waNum(x)))}>Send on WhatsApp one by one</${Btn}><${Btn} small onClick=${() => setSel([])}>Clear</${Btn}></div>`}
      <p className="sub" style=${{ margin: '0 0 8px' }}>${rows.length.toLocaleString('en-IN')} of ${all.length.toLocaleString('en-IN')} leads. Researched numbers come from public business listings, so confirm them on the first call.</p>
      <div className="card" style=${{ padding: 0 }}>${rows.length ? html`<div className="tbl-wrap"><table className="tbl ld-tbl"><thead><tr><th><input type="checkbox" checked=${allPicked} onChange=${e => setSel(e.target.checked ? [...new Set([...sel, ...pageWa])] : sel.filter(id => !pageWa.includes(id)))} aria-label="Select all with WhatsApp on this page" /></th><th>P</th><th>Business</th><th>City / area</th><th>Phone</th><th>Fits</th><th>Status</th><th>Next step</th><th></th></tr></thead><tbody>
        ${pg.rows.map(x => { const n = waNum(x); return html`<tr key=${x._id}>
          <td><input type="checkbox" checked=${sel.includes(x._id)} disabled=${!n} title=${n ? '' : 'No mobile number for WhatsApp'} onChange=${() => toggle(x._id)} aria-label=${'Select ' + biz(x)} /></td>
          <td><${Prio} p=${prio(x)} /></td>
          <td><button type="button" className="link ld-name" onClick=${() => setOpen(x._id)}>${biz(x)}</button><div className="ld-chips">${isWeb(x) && html`<span className="ld-chip ld-chip-web">Website enquiry</span>`}${x.category && html`<span className="ld-chip">${x.category}</span>`}${x.size && html`<span className="ld-chip">${x.size}</span>`}</div>${(x.why || x.message) && html`<div className="sub ld-why">${x.message || x.why}</div>`}</td>
          <td>${city(x)}<div className="sub">${x.area || ''}</div></td>
          <td className="nowrap">${x.phone ? html`<span className="mono">${x.phone}</span>` : html`<span className="sub">No number</span>`}${x.phone2 && html`<div className="mono">${x.phone2}</div>`}<div className="sub">${x.relay ? 'Directory line' : x.phone && !n ? 'Landline' : ''}</div></td>
          <td><div className="ld-chips">${prods(x).map(p => html`<span key=${p} className="ld-chip ld-chip-p">${p}</span>`)}</div></td>
          <td><${Status} s=${statusOf(x)} />${x.lastAt ? html`<div className="sub">${when(x.lastAt)} · ${who(x.lastBy)}</div>` : ''}</td>
          <td>${x.follow ? html`<span className=${x.follow <= today && !CLOSED.has(statusOf(x)) ? 'ld-due' : ''}>${x.follow}</span>` : ''}${x.notes && html`<div className="sub ld-why">${x.notes}</div>`}</td>
          <td><div className="row gap8"><${Btn} small kind="primary" onClick=${() => setOpen(x._id)}>Update status</${Btn}>${n && html`<${Btn} small icon="wa" href=${waLink(n, fill(tpl.text, x))} target="_blank">WhatsApp</${Btn}>`}</div></td></tr>`; })}
      </tbody></table></div>${pg.pager}` : html`<${Empty} icon="lead" title=${all.length ? 'No leads match these filters' : 'No leads yet'} text=${all.length ? 'Clear a filter to see more.' : 'Website enquiries appear here automatically. Use Upload to add your lead list.'} />`}</div>`;

    if (tab === 'follow') {
      const open7 = all.filter(x => x.follow && !CLOSED.has(statusOf(x)) && x.follow > today && x.follow <= addDays(7)).sort((a, b) => a.follow.localeCompare(b.follow));
      const acts = all.flatMap(x => (x.log || []).map(h => ({ ...h, l: x }))).sort((a, b) => b.t - a.t).slice(0, 40);
      const Row = x => html`<div className="ld-fu" key=${x._id}><div className="grow"><b>${biz(x)}</b> <span className="sub">${city(x)} · ${x.category || x.type || ''}</span>${x.notes && html`<div className="sub">${x.notes}</div>`}</div><span className=${cx('mono', x.follow <= today && 'ld-due')}>${x.follow}</span><${Status} s=${statusOf(x)} /><${Btn} small kind="primary" onClick=${() => setOpen(x._id)}>Update status</${Btn}></div>`;
      body = html`<div className="grid-2"><${Card} title=${'Due today & overdue (' + due.length + ')'}>${due.length ? due.sort((a, b) => a.follow.localeCompare(b.follow)).map(Row) : html`<p className="sub" style=${{ margin: 0 }}>Nothing due. Set a follow-up date when you update a status.</p>`}</${Card}>
        <${Card} title=${'Next 7 days (' + open7.length + ')'}>${open7.length ? open7.map(Row) : html`<p className="sub" style=${{ margin: 0 }}>No follow-ups this week.</p>`}</${Card}></div>
        <${Card} title="Recent activity">${acts.length ? html`<ul className="timeline">${acts.map((h, i) => html`<li key=${i}><span className="tl-dot"></span><div><b>${biz(h.l)}</b> <${Status} s=${h.status} /> <span className="sub">${h.type === 'whatsapp' ? 'WhatsApp' : h.type === 'import' ? 'Upload' : 'Call'} · ${when(h.t)} · ${who(h.by)}</span>${h.note && html`<div className="sub">${h.note}</div>`}</div></li>`)}</ul>` : html`<p className="sub" style=${{ margin: 0 }}>Each status update or WhatsApp send appears here.</p>`}</${Card}>`;
    }

    if (tab === 'insights') {
      const cnt = {}; all.forEach(x => { const s = statusOf(x); cnt[s] = (cnt[s] || 0) + 1; });
      const days = Array.from({ length: 14 }, (_, i) => addDays(i - 13));
      const logs = all.flatMap(x => x.log || []).filter(h => h.type !== 'import');
      const perDay = days.map(d => ({ label: d.slice(8) + '/' + d.slice(5, 7), value: logs.filter(h => dayOf(h.t) === d).length }));
      const team = {}; logs.forEach(h => { const k = who(h.by); team[k] = team[k] || { n: 0, w: 0, t: 0 }; team[k].n++; if (WARM.has(h.status)) team[k].w++; if (dayOf(h.t) === today) team[k].t++; });
      const prodRows = PRODUCTS.map(p => [p, [all.filter(x => prods(x).includes(p)).length]]).sort((a, b) => b[1][0] - a[1][0]);
      const won = all.filter(x => statusOf(x) === 'Won'), wonVal = won.reduce((a, x) => a + (Number(x.value) || 0), 0);
      body = html`<div className="grid-2">
        <${Card} title="Pipeline by status"><${HBars} rows=${ST.map(s => [ST_LABEL[s] || s, [cnt[s] || 0]])} colors=${['var(--green)']} /></${Card}>
        <${Card} title="Calls & WhatsApps, last 14 days"><${A.Bars} data=${perDay} height=${150} />${!logs.length && html`<p className="sub">Bars fill as the team updates statuses.</p>`}</${Card}>
        <${Card} title="By category"><${Legend} /><${HBars} rows=${stackBy(all, x => x.category || (isWeb(x) ? 'Website enquiry' : ''))} colors=${STACK_COLORS} /></${Card}>
        <${Card} title="By city"><${Legend} /><${HBars} rows=${stackBy(all, city)} colors=${STACK_COLORS} limit=${12} /></${Card}>
        <${Card} title="Top areas"><${Legend} /><${HBars} rows=${stackBy(all.filter(x => x.area), x => x.area)} colors=${STACK_COLORS} limit=${15} /></${Card}>
        <${Card} title="Product fit (number of leads)"><${HBars} rows=${prodRows} colors=${['var(--gold)']} /></${Card}>
        <${Card} title="Team activity">${Object.keys(team).length ? Object.entries(team).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => html`<div className="ld-fu" key=${k}><b className="grow">${k}</b><span className="mono">${v.t} today · ${v.n} total</span><${Badge} t=${v.w + ' warm'} tone="green" /></div>`) : html`<p className="sub" style=${{ margin: 0 }}>Shows each person's calls once statuses are updated.</p>`}</${Card}>
        <${Card} title="Orders won"><div className="kvs"><div><span>Leads won</span>${won.length}</div><div><span>Order value logged</span>${A.inr(wonVal)}</div><div><span>Win rate (contacted)</span>${all.filter(contacted).length ? Math.round(won.length / all.filter(contacted).length * 100) + '%' : '—'}</div><div><span>Website enquiries</span>${all.filter(isWeb).length}</div></div></${Card}>
      </div>`;
    }

    if (tab === 'messages') body = html`<${Templates} tpls=${tpls} canEdit=${A.canAdmin(role)} />`;

    return html`<div className="page">
      <div className="page-h"><div><h1>B2B leads</h1><p className="muted">Website enquiries and researched hotels, restaurants, cafes, bakeries and sweet shops — call, WhatsApp and follow up.</p></div>
        <div className="row gap8 wrap"><${Btn} icon="plus" onClick=${addOne}>Add lead</${Btn}><${Btn} icon="up" onClick=${() => setUp(true)}>Upload Excel / CSV</${Btn}><${Btn} icon="dl" onClick=${exportCsv}>Export</${Btn}></div></div>
      <div className="stats ld-stats">
        <${Stat} label="Leads" value=${all.length.toLocaleString('en-IN')} sub=${newWeb ? newWeb + ' new website enquir' + (newWeb === 1 ? 'y' : 'ies') : 'website + researched'} tone=${newWeb ? 'blue' : ''} onClick=${() => { setTab('list'); setSrc(newWeb ? 'web' : ''); setFs(newWeb ? 'New' : 'open'); }} />
        <${Stat} label="On WhatsApp" value=${all.filter(waNum).length.toLocaleString('en-IN')} sub="mobile numbers" onClick=${() => { setTab('list'); setFwa(true); }} />
        <${Stat} label="Contacted" value=${all.filter(contacted).length} onClick=${() => { setTab('list'); setFs(''); setSort('recent'); }} />
        <${Stat} label="Interested / sampling" value=${all.filter(x => ['Interested', 'Sample sent', 'Quoted'].includes(statusOf(x))).length} onClick=${() => { setTab('list'); setFs('Interested'); }} />
        <${Stat} label="Orders won" value=${all.filter(x => statusOf(x) === 'Won').length} onClick=${() => { setTab('list'); setFs('Won'); }} />
        <${Stat} label="Follow-ups due" value=${due.length} tone=${due.length ? 'red' : ''} onClick=${() => setTab('follow')} />
      </div>
      <${Tabs} value=${tab} onChange=${setTab} items=${[['list', 'Leads', rows.length], ['follow', 'Follow-ups', due.length], ['insights', 'Insights'], ['messages', 'Message templates']]} />
      ${body}
      ${l && html`<${LeadDrawer} key=${l._id} l=${l} tpl=${tpl} onClose=${() => setOpen(null)} />`}
      ${up && html`<${Upload} leads=${all} onClose=${() => setUp(false)} />`}
      ${queue && html`<${Queue} list=${queue} tpl=${tpl} onClose=${() => { setQueue(null); setSel([]); }} />`}
    </div>`;
  };

  // ---------- Message templates ----------
  function Templates({ tpls, canEdit }) {
    const [list, setList] = useState(tpls), [busy, setBusy] = useState(false);
    useEffect(() => setList(tpls), [tpls]);
    const set = (i, k, v) => setList(list.map((t, j) => j === i ? { ...t, [k]: v } : t));
    const save = async () => { setBusy(true); try { await A.run(A.saveLeadTemplates(list.filter(t => t.text.trim())), 'Templates saved'); } catch (e) { } setBusy(false); };
    const sample = { company: 'Sharma Bakers', location: 'Jaipur', category: 'Bakery', products: 'Tutti Frutti; Karonda Cherry' };
    return html`<div className="stack" style=${{ gap: 14 }}>
      <p className="muted" style=${{ margin: 0 }}>Use <span className="mono">{name}</span>, <span className="mono">{city}</span>, <span className="mono">{products}</span> and <span className="mono">{category}</span>; they fill in for each business. Messages open in WhatsApp Web with the text ready, and the team presses Send.${canEdit ? '' : ' Only the owner and admins can change templates.'}</p>
      ${list.map((t, i) => html`<${Card} key=${t.id} title=${canEdit ? html`<input className="inline-in" value=${t.name} onChange=${e => set(i, 'name', e.target.value)} aria-label="Template name" />` : t.name} actions=${canEdit && list.length > 1 ? html`<${Btn} small kind="danger-ghost" onClick=${() => setList(list.filter((_, j) => j !== i))}>Remove</${Btn}>` : null}>
        <div className="grid-2 tight"><${Field} label="Message"><textarea rows="9" value=${t.text} disabled=${!canEdit} onChange=${e => set(i, 'text', e.target.value)}></textarea></${Field}><${Field} label="Preview"><div className="ld-msg">${fill(t.text, sample)}</div></${Field}></div></${Card}>`)}
      ${canEdit && html`<div className="row gap8"><${Btn} icon="plus" onClick=${() => setList([...list, { id: 't' + Date.now().toString(36), name: 'New template', text: 'Namaste {name} ji,\n\n' }])}>Add template</${Btn}><${Btn} kind="primary" disabled=${busy} onClick=${save}>${busy ? 'Saving…' : 'Save templates'}</${Btn}></div>`}
    </div>`;
  }
})();
