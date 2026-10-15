// APAR Admin — Products, product editor and Inventory.
(function () {
  const A = window.AA;
  const { useState, useMemo, useEffect, useRef } = React;
  const { html, Btn, Badge, Card, Field, Empty, Tabs, Icon, inr, cx, DETAILS } = A;

  const catName = (cat, slug) => (cat.cats.find(c => c.slug === slug) || {}).name || slug;

  // ---------------- Products ----------------
  A.Products = function ({ data }) {
    const cat = data.catalog;
    const [q, setQ] = useState(''), [c, setC] = useState('all'), [view, setView] = useState('all');
    if (!cat) return null;
    const ql = q.trim().toLowerCase();
    const list = cat.products.filter(p => (c === 'all' || p.cat === c) && (view === 'all' || (view === 'live' ? !p.hidden : p.hidden)) && (!ql || (p.name + ' ' + p.short).toLowerCase().includes(ql)));
    const lowLimit = Number(cat.site.lowStock || 10);
    return html`<div className="page">
      <div className="page-h"><div><h1>Products</h1><p className="muted">${cat.products.length} products · ${cat.products.filter(p => !p.hidden).length} live on the store</p></div>
        <${Btn} kind="primary" icon="plus" onClick=${() => A.go('products/new')}>Add product</${Btn}></div>
      <div className="filters">
        <div className="search"><${Icon} n="search" s=${16} /><input value=${q} onChange=${e => setQ(e.target.value)} placeholder="Search products" aria-label="Search products" /></div>
        <select className="sel" value=${c} onChange=${e => setC(e.target.value)} aria-label="Category"><option value="all">All categories</option>${cat.cats.map(k => html`<option key=${k.slug} value=${k.slug}>${k.name}</option>`)}</select>
        <select className="sel" value=${view} onChange=${e => setView(e.target.value)} aria-label="Visibility"><option value="all">Live and hidden</option><option value="live">Live only</option><option value="hidden">Hidden only</option></select>
      </div>
      ${list.length ? html`<div className="pgrid">${list.map(p => {
        const vs = A.vars(cat.px, p), stock = vs.reduce((a, v) => a + v.stock, 0), lo = Math.min(...vs.map(v => v.price)), hi = Math.max(...vs.map(v => v.price));
        const anyLow = vs.some(v => v.stock <= lowLimit);
        return html`<article key=${p.id} className=${cx('pcard', p.hidden && 'is-hidden')}>
          <button type="button" className="pimg" onClick=${() => A.go('products/' + p.id)} aria-label=${'Edit ' + p.name}>${p.img ? html`<img src=${(p.img.indexOf('/') === 0 || p.img.indexOf('http') === 0 || p.img.indexOf('data:') === 0) ? p.img : '/' + p.img} alt="" loading="lazy" />` : html`<${Icon} n="box" s=${36} />`}</button>
          <div className="pbody"><div className="row between"><span className="sub">${catName(cat, p.cat)}</span><${Badge} t=${p.hidden ? 'Hidden' : 'Live'} /></div>
            <h3>${p.name}</h3>
            <div className="row between"><b>${lo === hi ? inr(lo) : inr(lo) + ' – ' + inr(hi)}</b><span className=${cx('sub', anyLow && 'warn')}>${stock} in stock${anyLow ? ' · low' : ''}</span></div>
            <div className="sub">${vs.map(v => v.size).join(' · ')}</div>
            <div className="row gap8" style=${{ marginTop: 10 }}><${Btn} small icon="edit" onClick=${() => A.go('products/' + p.id)}>Edit</${Btn}><${Btn} small icon=${p.hidden ? 'eye' : 'eyeoff'} onClick=${() => A.run(A.setHidden(cat, p.id, !p.hidden), p.hidden ? 'Now live on the store' : 'Hidden from the store')}>${p.hidden ? 'Show' : 'Hide'}</${Btn}><${Btn} small icon="ext" href=${'/#/product/' + p.id} target="_blank" title="View on store"></${Btn}></div></div>
        </article>`;
      })}</div>` : html`<${Empty} title="No products match" action=${html`<${Btn} kind="primary" icon="plus" onClick=${() => A.go('products/new')}>Add product</${Btn}>`} />`}
    </div>`;
  };

  // ---------------- Product editor ----------------
  const imgSrc = s => !s ? '' : (s.indexOf('/') === 0 || s.indexOf('http') === 0 || s.indexOf('data:') === 0) ? s : '/' + s;
  function draftFrom(cat, p) {
    if (!p) return { isNew: true, name: '', cat: (cat.cats[0] || {}).slug, newCat: '', short: '', uses: '', featured: false, hidden: false, imgs: [], hsn: '', gst: '', details: {}, variants: [{ size: '', g: '', mrp: '', price: '', stock: '', sku: '' }] };
    return { isNew: false, id: p.id, name: p.name, cat: p.cat, newCat: '', short: p.short || '', uses: p.uses || '', featured: !!p.featured, hidden: !!p.hidden,
      imgs: (p.gallery && p.gallery.length ? p.gallery : [p.img]).filter(Boolean), hsn: p.hsn || '', gst: p.gst == null ? '' : p.gst, details: Object.assign({}, p.details || {}),
      variants: A.vars(cat.px, p).map(v => ({ size: v.size, g: v.g || '', mrp: v.mrp, price: v.price, stock: v.stock, sku: v.sku })) };
  }

  A.ProductEditor = function ({ data, id }) {
    const cat = data.catalog;
    const p = id === 'new' ? null : cat && cat.products.find(x => x.id === id);
    const [d, setD] = useState(null);
    const [busy, setBusy] = useState(false), [uploading, setUploading] = useState(0);
    const fileRef = useRef();
    useEffect(() => { if (cat && (id === 'new' || p)) setD(draftFrom(cat, p)); }, [id, !!cat, !!p]);
    if (!cat) return null;
    if (id !== 'new' && !p) return html`<div className="page"><${Empty} title="Product not found" action=${html`<${Btn} onClick=${() => A.go('products')}>Back to products</${Btn}>`} /></div>`;
    if (!d) return null;
    const set = o => setD(Object.assign({}, d, o));
    const setV = (i, o) => set({ variants: d.variants.map((v, j) => j === i ? Object.assign({}, v, o) : v) });
    const move = (i, k) => { const a = d.imgs.slice(); const j = i + k; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; set({ imgs: a }); };
    const upload = async files => {
      files = [...files]; if (!files.length) return;
      setUploading(files.length);
      const urls = [];
      for (const f of files) { try { urls.push(await A.upload(f)); } catch (e) { A.toast(e.message, 'error'); } setUploading(n => n - 1); }
      setD(cur => Object.assign({}, cur, { imgs: [...cur.imgs, ...urls] }));
      if (urls.length) A.toast(urls.length + ' photo(s) uploaded. Click Save to publish.', 'ok');
    };
    const save = async () => {
      setBusy(true);
      try { const nid = await A.saveProduct(d, cat); A.toast(d.name + (d.isNew ? ' added to the store' : ' saved'), 'ok'); A.go('products'); }
      catch (e) { A.toast(e.message, 'error'); }
      setBusy(false);
    };
    const del = async () => {
      const ok = await A.confirm({ title: 'Delete ' + p.name + '?', text: 'It disappears from the store. Old orders keep their details. Tip: use Hide instead if you may sell it again.', ok: 'Delete product', danger: true });
      if (ok) { await A.run(A.deleteProduct(cat, p.id), 'Product deleted'); A.go('products'); }
    };

    return html`<div className="page narrow">
      <div className="page-h"><div><button className="link back" onClick=${() => A.go('products')}><${Icon} n="left" s=${15} /> Products</button><h1>${d.isNew ? 'Add product' : d.name || 'Edit product'}</h1></div>
        <div className="row gap8">${!d.isNew && html`<${Btn} icon="ext" href=${'/#/product/' + d.id} target="_blank">View on store</${Btn}>`}<${Btn} kind="primary" onClick=${save} disabled=${busy || uploading > 0}>${busy ? 'Saving…' : 'Save product'}</${Btn}></div></div>

      <${Card} title="Basic details"><div className="form-grid">
        <${Field} label="Product name" wide=${true}><input value=${d.name} onChange=${e => set({ name: e.target.value })} placeholder="e.g. APAR Rose Gulkand" /></${Field}>
        <${Field} label="Category"><select value=${d.newCat ? '__new' : d.cat} onChange=${e => e.target.value === '__new' ? set({ newCat: ' ' }) : set({ cat: e.target.value, newCat: '' })}>${cat.cats.map(k => html`<option key=${k.slug} value=${k.slug}>${k.name}</option>`)}<option value="__new">+ New category…</option></select></${Field}>
        ${d.newCat ? html`<${Field} label="New category name"><input value=${d.newCat.trim()} onChange=${e => set({ newCat: e.target.value || ' ' })} placeholder="e.g. Sharbat" autoFocus /></${Field}>` : html`<div></div>`}
        <${Field} label="Short description" wide=${true} hint="Shown under the product name and in search."><textarea rows="2" value=${d.short} onChange=${e => set({ short: e.target.value })}></textarea></${Field}>
        <${Field} label="Uses" wide=${true}><input value=${d.uses} onChange=${e => set({ uses: e.target.value })} placeholder="e.g. With milk, desserts, ice cream or paan" /></${Field}>
        <label className="check"><input type="checkbox" checked=${!d.hidden} onChange=${e => set({ hidden: !e.target.checked })} /> Show on the store</label>
        <label className="check"><input type="checkbox" checked=${d.featured} onChange=${e => set({ featured: e.target.checked })} /> Signature product (shown on the homepage)</label>
      </div></${Card}>

      <${Card} title="Photos" actions=${html`<${Btn} small icon="plus" onClick=${() => fileRef.current.click()} disabled=${uploading > 0}>${uploading ? 'Uploading ' + uploading + '…' : 'Upload photos'}</${Btn}>`}>
        <input ref=${fileRef} type="file" accept="image/*" multiple style=${{ display: 'none' }} onChange=${e => { upload(e.target.files); e.target.value = ''; }} />
        ${d.imgs.length ? html`<div className="photos">${d.imgs.map((s, i) => html`<figure key=${s + i} className=${i === 0 ? 'main' : ''}><img src=${imgSrc(s)} alt="" />${i === 0 && html`<span className="ph-tag">Main photo</span>`}
          <figcaption><button className="icon-btn" onClick=${() => move(i, -1)} disabled=${i === 0} aria-label="Move left"><${Icon} n="left" s=${15} /></button><button className="icon-btn" onClick=${() => move(i, 1)} disabled=${i === d.imgs.length - 1} aria-label="Move right"><${Icon} n="right" s=${15} /></button><button className="icon-btn danger" onClick=${() => set({ imgs: d.imgs.filter((x, j) => j !== i) })} aria-label="Remove photo"><${Icon} n="trash" s=${15} /></button></figcaption></figure>`)}</div>`
          : html`<button type="button" className="drop" onClick=${() => fileRef.current.click()} onDragOver=${e => e.preventDefault()} onDrop=${e => { e.preventDefault(); upload(e.dataTransfer.files); }}><${Icon} n="plus" s=${26} /><span>Click or drop photos here</span><span className="sub">JPG or PNG. Photos are resized automatically. The first photo is the main one.</span></button>`}
      </${Card}>

      <${Card} title="Pack sizes, prices and stock" actions=${html`<${Btn} small icon="plus" onClick=${() => set({ variants: [...d.variants, { size: '', g: '', mrp: '', price: '', stock: '', sku: '' }] })}>Add pack size</${Btn}>`} pad=${false}>
        <div className="tbl-wrap"><table className="tbl edit"><thead><tr><th>Pack size</th><th>Weight (g)</th><th>MRP ₹</th><th>Selling price ₹</th><th>Stock</th><th>SKU</th><th></th></tr></thead><tbody>
        ${d.variants.map((v, i) => html`<tr key=${i}><td><input value=${v.size} onChange=${e => setV(i, { size: e.target.value })} placeholder="250 g" /></td><td><input type="number" value=${v.g} onChange=${e => setV(i, { g: e.target.value })} placeholder="250" /></td>
          <td><input type="number" value=${v.mrp} onChange=${e => setV(i, { mrp: e.target.value })} /></td><td><input type="number" value=${v.price} onChange=${e => setV(i, { price: e.target.value })} /></td>
          <td><input type="number" value=${v.stock} onChange=${e => setV(i, { stock: e.target.value })} /></td><td><input value=${v.sku} onChange=${e => setV(i, { sku: e.target.value })} placeholder="Auto" /></td>
          <td><button className="icon-btn danger" disabled=${d.variants.length === 1} onClick=${() => set({ variants: d.variants.filter((x, j) => j !== i) })} aria-label="Remove pack"><${Icon} n="trash" s=${15} /></button></td></tr>`)}
        </tbody></table></div>
        <p className="sub pad">Discount % is calculated from MRP and selling price. Stock changes here are saved directly; for day-to-day stock movements use Inventory (keeps a history).</p>
      </${Card}>

      <${Card} title="Tax (for GST invoices)"><div className="form-grid">
        <${Field} label="HSN code" hint="e.g. 2008 for fruit preserves. Ask your CA if unsure."><input value=${d.hsn} onChange=${e => set({ hsn: e.target.value })} /></${Field}>
        <${Field} label="GST rate %" hint="Prices on the store already include GST."><select value=${String(d.gst)} onChange=${e => set({ gst: e.target.value })}><option value="">Not set</option>${[0, 5, 12, 18, 28].map(r => html`<option key=${r} value=${String(r)}>${r}%</option>`)}</select></${Field}>
      </div></${Card}>

      <${Card} title="Product information (shown on the product page)"><div className="form-grid">
        ${DETAILS.map(([k, l]) => html`<${Field} key=${k} label=${l}><input value=${d.details[k] || ''} onChange=${e => set({ details: Object.assign({}, d.details, { [k]: e.target.value }) })} placeholder="To be confirmed" /></${Field}>`)}
      </div></${Card}>

      <div className="row between wrap gap8" style=${{ marginTop: 8 }}>${!d.isNew ? html`<${Btn} kind="danger-ghost" icon="trash" onClick=${del}>Delete product</${Btn}>` : html`<span></span>`}<div className="row gap8"><${Btn} onClick=${() => A.go('products')}>Cancel</${Btn}><${Btn} kind="primary" onClick=${save} disabled=${busy || uploading > 0}>${busy ? 'Saving…' : 'Save product'}</${Btn}></div></div>
    </div>`;
  };

  // ---------------- Inventory ----------------
  A.Inventory = function ({ data, role }) {
    const cat = data.catalog;
    const [tab, setTab] = useState('stock'), [q, setQ] = useState(''), [onlyLow, setOnlyLow] = useState(false);
    if (!cat) return null;
    const lowLimit = Number(cat.site.lowStock || 10);
    const res = A.reserved(data.orders);
    const rows = [];
    cat.products.forEach(p => A.vars(cat.px, p).forEach(v => rows.push({ p, v, reserved: res[v.sku] || 0 })));
    const ql = q.trim().toLowerCase();
    const list = rows.filter(r => (!onlyLow || r.v.stock <= lowLimit) && (!ql || (r.p.name + ' ' + r.v.size + ' ' + r.v.sku).toLowerCase().includes(ql)));
    const canEdit = A.canAdmin(role);
    const adjust = async (r, kind) => {
      const f = await A.ask({ title: (kind === 'in' ? 'Add stock · ' : 'Remove stock · ') + r.p.name.replace('APAR ', '') + ' ' + r.v.size, text: 'Current stock: ' + r.v.stock, fields: [{ k: 'qty', label: 'Quantity', type: 'number', value: '' }, { k: 'type', label: 'Reason', options: kind === 'in' ? ['Stock in', 'Return to stock', 'Correction'] : ['Damaged', 'Stock out', 'Sample / gift', 'Correction'] }, { k: 'note', label: 'Note (optional)', ph: 'e.g. Batch #12 from factory' }], ok: kind === 'in' ? 'Add stock' : 'Remove stock' });
      if (!f) return; const n = Math.abs(parseInt(f.qty, 10) || 0); if (!n) return A.toast('Enter a quantity', 'error');
      await A.run(A.adjustStock(r.p.id, r.v.i, kind === 'in' ? n : -n, f.type, f.note), 'Stock updated');
    };
    const hist = data.hist || [];
    return html`<div className="page">
      <div className="page-h"><div><h1>Inventory</h1><p className="muted">${rows.length} SKUs · ${rows.filter(r => r.v.stock <= lowLimit).length} low on stock (≤ ${lowLimit})</p></div>
        <${Btn} icon="dl" onClick=${() => A.csv('APAR-Inventory-' + A.todayISO() + '.csv', [['SKU', 'Product', 'Pack', 'In stock', 'Reserved in open orders', 'MRP', 'Price'], ...rows.map(r => [r.v.sku, r.p.name, r.v.size, r.v.stock, r.reserved, r.v.mrp, r.v.price])])}>Export</${Btn}></div>
      <${Tabs} value=${tab} onChange=${setTab} items=${[['stock', 'Stock levels'], ['hist', 'History', hist.length]]} />
      ${tab === 'stock' ? html`<div className="filters"><div className="search"><${Icon} n="search" s=${16} /><input value=${q} onChange=${e => setQ(e.target.value)} placeholder="Search product or SKU" aria-label="Search SKU" /></div><label className="check"><input type="checkbox" checked=${onlyLow} onChange=${e => setOnlyLow(e.target.checked)} /> Low stock only</label></div>
        <div className="card" style=${{ padding: 0 }}><div className="tbl-wrap"><table className="tbl"><thead><tr><th>Product</th><th>SKU</th><th className="r">In stock</th><th className="r">In open orders</th><th>Status</th>${canEdit && html`<th className="r">Price ₹</th><th className="r">MRP ₹</th>`}<th></th></tr></thead><tbody>
        ${list.map(r => { const st = r.v.stock <= 0 ? 'Out of stock' : r.v.stock <= lowLimit ? 'Low stock' : 'In stock'; return html`<tr key=${r.v.sku + r.p.id}><td>${r.p.name.replace('APAR ', '')}<div className="sub">${r.v.size}${r.p.hidden ? ' · hidden' : ''}</div></td><td className="sub">${r.v.sku}</td><td className="r"><b>${r.v.stock}</b></td><td className="r">${r.reserved}</td><td><${Badge} t=${st} /></td>
          ${canEdit && html`<td className="r"><${A.SaveInput} type="number" width="80px" value=${r.v.price} onSave=${v => A.run(A.setPrice(r.p.id, r.v.i, 'price', v), 'Price saved')} /></td><td className="r"><${A.SaveInput} type="number" width="80px" value=${r.v.mrp} onSave=${v => A.run(A.setPrice(r.p.id, r.v.i, 'mrp', v), 'MRP saved')} /></td>`}
          <td className="r nowrap"><${Btn} small onClick=${() => adjust(r, 'in')}>+ Add</${Btn}> <${Btn} small onClick=${() => adjust(r, 'out')}>− Remove</${Btn}></td></tr>`; })}
        </tbody></table></div></div>`
      : html`<div className="card" style=${{ padding: 0 }}>${hist.length ? html`<div className="tbl-wrap"><table className="tbl"><thead><tr><th>When</th><th>SKU</th><th>Movement</th><th className="r">Qty</th><th>Note</th></tr></thead><tbody>${hist.map((h, i) => html`<tr key=${i}><td className="sub">${h.date}</td><td>${h.sku}</td><td><${Badge} t=${h.type} tone=${/in|Return/i.test(h.type) ? 'green' : h.type === 'Damaged' ? 'red' : 'grey'} /></td><td className="r">${/in|Return/i.test(h.type) ? '+' : '−'}${h.qty}</td><td className="sub">${h.note}${h.by ? ' · ' + h.by : ''}</td></tr>`)}</tbody></table></div>` : html`<${Empty} icon="stock" title="No stock movements yet" text="Sales, cancellations and manual changes are recorded here." />`}</div>`}
    </div>`;
  };
})();
