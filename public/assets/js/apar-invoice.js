// APAR — branded PDF tax invoice (used by the website "Download invoice" button and the admin app).
// Usage: AparInvoice.download(orders, { site, products })
(function (root) {
  const BASE = '/assets/pdf/';
  const GREEN = [15, 59, 46], GOLD = [176, 141, 87], IVORY = [247, 242, 232], INK = [28, 36, 32], MUTED = [107, 101, 82], LINE = [224, 211, 184], SOFT = [251, 248, 241];
  let ready = null;

  const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s); });
  const b64 = buf => { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
  const get = async (f, type) => { const r = await fetch(BASE + f); if (!r.ok) throw new Error('Could not load ' + f); return type === 'buf' ? r.arrayBuffer() : r.blob(); };
  const dataUrl = blob => new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });

  function prepare() {
    if (root.__aparInvoiceAssets) return Promise.resolve(root.__aparInvoiceAssets);
    if (ready) return ready;
    ready = (async () => {
      if (!(root.jspdf && root.jspdf.jsPDF)) await loadScript(BASE + 'jspdf.umd.min.js');
      if (!root.jspdf.jsPDF.API.autoTable) await loadScript(BASE + 'jspdf.plugin.autotable.min.js');
      const [reg, semi, serif, logo] = await Promise.all([get('Poppins_400Regular.ttf', 'buf'), get('Poppins_600SemiBold.ttf', 'buf'), get('BodoniModa_500Medium.ttf', 'buf'), get('apar-logo.png').then(dataUrl)]);
      return { reg: b64(reg), semi: b64(semi), serif: b64(serif), logo };
    })();
    ready.catch(() => { ready = null; });
    return ready;
  }

  // ---------- helpers ----------
  const money = n => '₹' + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = n => n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  const three = n => (n >= 100 ? ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' : '') : '') + (n % 100 ? two(n % 100) : '');
  function words(amount) {
    let n = Math.floor(amount), p = Math.round((amount - n) * 100), out = [];
    if (n === 0) out.push('Zero');
    const cr = Math.floor(n / 1e7); n %= 1e7; const lk = Math.floor(n / 1e5); n %= 1e5; const th = Math.floor(n / 1e3); n %= 1e3;
    if (cr) out.push(three(cr) + ' Crore'); if (lk) out.push(two(lk) + ' Lakh'); if (th) out.push(two(th) + ' Thousand'); if (n) out.push(three(n));
    return 'Rupees ' + out.join(' ') + (p ? ' and ' + two(p) + ' Paise' : '') + ' Only';
  }
  const RAJ_PIN = pin => /^3[0-4]/.test(String(pin || ''));

  function compute(o, products, site) {
    const intra = RAJ_PIN(o.pin) && (!site.state || /rajasthan/i.test(site.state));
    const sub = o.sub || (o.items || []).reduce((a, i) => a + i.price * i.qty, 0);
    const dr = sub ? (o.disc || 0) / sub : 0;
    let anyRate = false, tTaxable = 0, tTax = 0;
    const rows = (o.items || []).map((i, n) => {
      const p = (products || []).find(x => x.id === i.pid) || {};
      const rate = p.gst === '' || p.gst == null || isNaN(Number(p.gst)) ? null : Number(p.gst);
      const amt = i.price * i.qty * (1 - dr);
      const taxable = rate == null ? amt : amt / (1 + rate / 100), tax = amt - taxable;
      if (rate != null) { anyRate = true; tTax += tax; }
      tTaxable += taxable;
      return { n: n + 1, name: i.name, size: i.size, sku: i.sku || '', hsn: p.hsn || '', qty: i.qty, rate: i.price, taxable, gstRate: rate, tax, amt };
    });
    return { intra, rows, anyRate, tTaxable, tTax, sub };
  }

  // ---------- one invoice page ----------
  function page(doc, o, ctx, assets) {
    const S = ctx.site || {}, W = 210, M = 14;
    const seller = {
      name: S.legalName || 'Apar Fragrances', address: S.address || '0-33, Amber Tower, Sansar Chand Road, Jaipur', state: S.state || 'Rajasthan',
      phone: S.phone || '78519 78274', email: S.email || 'aparfragrances@gmail.com', gstin: S.gstin || '', fssai: S.fssai || '', web: ctx.web || 'www.aparfragrances.com'
    };
    const C = compute(o, ctx.products, S);
    const font = (f, size, color) => { doc.setFont(f === 'b' ? 'PoppinsSemi' : f === 's' ? 'Bodoni' : 'Poppins', 'normal'); doc.setFontSize(size); doc.setTextColor.apply(doc, color || INK); };

    // Header band
    doc.setFillColor.apply(doc, IVORY); doc.rect(0, 0, W, 58, 'F');
    doc.setFillColor.apply(doc, GREEN); doc.rect(0, 0, W, 4, 'F');
    doc.addImage(assets.logo, 'PNG', M, 11, 42, 16.8);
    font('b', 10.5, GREEN); doc.text(seller.name, M, 35);
    font('r', 8, MUTED);
    const addr = doc.splitTextToSize(seller.address + ', ' + seller.state, 92);
    doc.text(addr, M, 40);
    let y = 40 + addr.length * 3.6;
    doc.text(seller.phone + '  ·  ' + seller.email, M, y); y += 3.6;
    const ids = [seller.gstin && 'GSTIN: ' + seller.gstin, seller.fssai && 'FSSAI Lic. No: ' + seller.fssai].filter(Boolean).join('   ·   ');
    if (ids) { font('b', 8, INK); doc.text(ids, M, y); }

    font('s', 24, GREEN); doc.text('Tax Invoice', W - M, 20, { align: 'right' });
    font('r', 7.5, GOLD); doc.text('ORIGINAL FOR RECIPIENT', W - M, 25.5, { align: 'right', charSpace: 0.6 });
    const paid = o.payStatus === 'Paid', refunded = o.payStatus === 'Refunded';
    const meta = [['Invoice no.', o.id], ['Invoice date', o.date], ['Payment', String(o.pay || '').replace('Online · ', 'Online – ')], ['Place of supply', C.intra ? 'Rajasthan (08)' : 'Outside Rajasthan']];
    let my = 33;
    meta.forEach(([k, v]) => { font('r', 7.5, MUTED); doc.text(k, 128, my); font('b', 8.5, INK); doc.text(String(v || '—'), W - M, my, { align: 'right' }); my += 5; });
    // status pill
    const pill = refunded ? 'REFUNDED' : paid ? 'PAID' : /COD/.test(o.pay) ? 'CASH ON DELIVERY' : String(o.payStatus || '').toUpperCase();
    font('b', 7, paid ? [31, 122, 69] : GOLD);
    const pw = doc.getTextWidth(pill) + 6;
    doc.setDrawColor.apply(doc, paid ? [31, 122, 69] : GOLD); doc.setLineWidth(0.35); doc.roundedRect(W - M - pw, my - 2.2, pw, 5.2, 2.6, 2.6, 'S');
    doc.text(pill, W - M - pw / 2, my + 1.2, { align: 'center' });
    doc.setDrawColor.apply(doc, GOLD); doc.setLineWidth(0.6); doc.line(0, 58, W, 58);

    // Bill / ship to + order summary
    y = 66;
    doc.setFillColor.apply(doc, SOFT); doc.setDrawColor.apply(doc, LINE); doc.setLineWidth(0.25);
    doc.roundedRect(M, y, 104, 31, 2, 2, 'FD'); doc.roundedRect(122, y, W - M - 122, 31, 2, 2, 'FD');
    font('r', 7, GOLD); doc.text('BILL TO / SHIP TO', M + 4, y + 6, { charSpace: 0.5 });
    font('b', 10, INK); doc.text(o.name || '', M + 4, y + 12);
    font('r', 8, INK);
    const to = doc.splitTextToSize([o.address, (o.city || '') + ' – ' + (o.pin || '')].filter(Boolean).join(', '), 96);
    doc.text(to.slice(0, 2), M + 4, y + 17);
    font('r', 8, MUTED); doc.text('Phone: ' + (o.phone || '') + (o.email ? '   ·   ' + o.email : ''), M + 4, y + 17 + Math.min(2, to.length) * 3.8 + 1);
    font('r', 7, GOLD); doc.text('ORDER SUMMARY', 126, y + 6, { charSpace: 0.5 });
    const items = (o.items || []).reduce((a, i) => a + i.qty, 0);
    [['Order ID', o.id], ['Items', items + (items === 1 ? ' item' : ' items')], ['Order total', money(o.total)]].forEach(([k, v], i) => { font('r', 8, MUTED); doc.text(k, 126, y + 13 + i * 5.5); font('b', 8.5, INK); doc.text(v, W - M - 4, y + 13 + i * 5.5, { align: 'right' }); });

    // Items table
    const head = [['#', 'Item', 'HSN', 'Qty', 'Rate', 'Taxable value', C.intra ? 'CGST + SGST' : 'IGST', 'Amount']];
    const body = C.rows.map(r => [r.n, r.name + '\n' + r.size + (r.sku ? '  ·  ' + r.sku : ''), r.hsn || '—', r.qty, money(r.rate), money(r.taxable),
      r.gstRate == null ? 'Incl.' : (C.intra ? (r.gstRate / 2) + '% + ' + (r.gstRate / 2) + '%\n' : r.gstRate + '%\n') + money(r.tax), money(r.amt)]);
    doc.autoTable({
      startY: y + 38, head, body, theme: 'plain', margin: { left: M, right: M },
      styles: { font: 'Poppins', fontSize: 8, textColor: INK, cellPadding: { top: 2.6, bottom: 2.6, left: 2.4, right: 2.4 }, lineColor: LINE, lineWidth: { bottom: 0.2 }, valign: 'middle' },
      headStyles: { font: 'PoppinsSemi', fillColor: GREEN, textColor: [255, 255, 255], fontSize: 7.5, lineWidth: 0 },
      alternateRowStyles: { fillColor: [252, 250, 245] },
      columnStyles: { 0: { cellWidth: 8, halign: 'center' }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 15, halign: 'center' }, 3: { cellWidth: 10, halign: 'center' }, 4: { cellWidth: 20, halign: 'right' }, 5: { cellWidth: 24, halign: 'right' }, 6: { cellWidth: 25, halign: 'right' }, 7: { cellWidth: 24, halign: 'right', font: 'PoppinsSemi' } },
      didParseCell: d => { if (d.section === 'head' && d.column.index >= 4) d.cell.styles.halign = 'right'; if (d.section === 'head' && (d.column.index === 0 || d.column.index === 2 || d.column.index === 3)) d.cell.styles.halign = 'center'; }
    });
    y = doc.lastAutoTable.finalY + 6;
    if (y > 205) { doc.addPage(); y = 20; }

    // Totals (right)
    const tx = 122, tw = W - M - tx;
    const lines = [['Items total (incl. GST)', money(C.sub)]];
    if (o.disc) lines.push(['Discount' + (o.coupon ? ' (' + o.coupon + ')' : ''), '− ' + money(o.disc)]);
    lines.push(['Delivery charges', o.ship ? money(o.ship) : 'Free']);
    if (C.anyRate) {
      lines.push(['Taxable value', money(C.tTaxable)]);
      if (C.intra) { lines.push(['CGST', money(C.tTax / 2)]); lines.push(['SGST', money(C.tTax / 2)]); } else lines.push(['IGST', money(C.tTax)]);
    }
    let ty = y;
    lines.forEach(([k, v]) => { font('r', 8.5, MUTED); doc.text(k, tx, ty + 4); font('r', 8.5, INK); doc.text(v, W - M, ty + 4, { align: 'right' }); ty += 6; });
    doc.setFillColor.apply(doc, GREEN); doc.roundedRect(tx - 3, ty, tw + 3, 11, 1.5, 1.5, 'F');
    font('b', 9, [255, 255, 255]); doc.text('Grand total', tx, ty + 7.2); font('b', 12, [255, 255, 255]); doc.text(money(o.total), W - M - 2, ty + 7.6, { align: 'right' });
    ty += 15;

    // Left column: amount in words, payment, notes
    let ly = y;
    font('r', 7, GOLD); doc.text('AMOUNT IN WORDS', M, ly + 4, { charSpace: 0.5 });
    font('b', 8.5, INK); const w = doc.splitTextToSize(words(Number(o.total) || 0), 98); doc.text(w, M, ly + 9); ly += 9 + w.length * 4 + 4;
    font('r', 7, GOLD); doc.text('PAYMENT DETAILS', M, ly, { charSpace: 0.5 }); ly += 5;
    font('r', 8, INK);
    const payLines = [String(o.pay || '') + '  ·  ' + (o.payStatus || ''), o.txn ? 'Transaction ID: ' + o.txn : (/COD/.test(o.pay) && !paid ? 'Amount payable on delivery: ' + money(o.total) : '')].filter(Boolean);
    doc.text(payLines, M, ly); ly += payLines.length * 4 + 4;
    font('r', 7.2, MUTED);
    const notes = doc.splitTextToSize((C.anyRate ? 'All prices are inclusive of GST. ' : 'All prices are inclusive of applicable GST. ') + 'Goods once sold are subject to APAR\'s return & refund policy. For any help with this order, write to ' + seller.email + ' or call ' + seller.phone + '.', 98);
    doc.text(notes, M, ly); ly += notes.length * 3.4;

    // Signature + thank you
    let sy = Math.max(ty, ly) + 10;
    if (sy > 250) { doc.addPage(); sy = 24; }
    font('s', 15, GREEN); doc.text('Thank you for choosing APAR', M, sy + 6);
    font('r', 8, MUTED); doc.text('Crafted with care in Jaipur.', M, sy + 11.5);
    font('r', 8, INK); doc.text('For ' + seller.name, W - M, sy + 2, { align: 'right' });
    doc.setDrawColor.apply(doc, LINE); doc.setLineWidth(0.3); doc.line(W - M - 55, sy + 15, W - M, sy + 15);
    font('r', 7.5, MUTED); doc.text('Authorised Signatory', W - M, sy + 19, { align: 'right' });

    // Footer bar
    doc.setFillColor.apply(doc, GREEN); doc.rect(0, 284, W, 13, 'F');
    font('r', 7.5, [226, 199, 146]); doc.text(seller.web + '   ·   ' + seller.phone + '   ·   ' + seller.email, W / 2, 290.5, { align: 'center' });
    font('r', 6.5, [182, 196, 186]); doc.text('This is a computer-generated invoice and does not require a physical signature.', W / 2, 294.2, { align: 'center' });
  }

  async function build(orders, ctx) {
    const assets = await prepare();
    const { jsPDF } = root.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    doc.addFileToVFS('Poppins.ttf', assets.reg); doc.addFont('Poppins.ttf', 'Poppins', 'normal');
    doc.addFileToVFS('PoppinsSemi.ttf', assets.semi); doc.addFont('PoppinsSemi.ttf', 'PoppinsSemi', 'normal');
    doc.addFileToVFS('Bodoni.ttf', assets.serif); doc.addFont('Bodoni.ttf', 'Bodoni', 'normal');
    doc.setProperties({ title: orders.length === 1 ? 'APAR Tax Invoice ' + orders[0].id : 'APAR Tax Invoices', author: 'APAR', creator: 'APAR' });
    orders.forEach((o, i) => { if (i) doc.addPage(); page(doc, o, ctx || {}, assets); });
    return doc;
  }

  root.AparInvoice = {
    prepare,
    build,
    async download(orders, ctx) {
      orders = Array.isArray(orders) ? orders : [orders];
      const doc = await build(orders, ctx);
      doc.save(orders.length === 1 ? 'APAR-Invoice-' + orders[0].id + '.pdf' : 'APAR-Invoices-' + orders.length + '.pdf');
    },
    words
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.AparInvoice;
})(typeof window !== 'undefined' ? window : globalThis);
