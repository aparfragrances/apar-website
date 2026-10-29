// Lead Desk: add one lead or import many (Excel/CSV upload) for the APAR team.
// Staff can update leads directly from the admin app; creating leads goes through here.
const C = require('../lib/core');

const STATUSES = ['New', 'WhatsApp sent', 'No answer', 'Call back', 'Contacted', 'Interested', 'Sample sent', 'Quoted', 'Won', 'Lost', 'Wrong number'];
const CATS = ['Bakery', 'Sweet Shop', 'Ice Cream & Desserts', 'Hotel', 'Restaurant', 'Cafe', 'Paan & Mukhwas', 'Caterer', 'Wholesaler'];
const key10 = p => { const d = String(p || '').replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : ''; };
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

function toLead(r, by, now) {
  const status = STATUSES.includes(r.status) ? r.status : 'New';
  const lead = {
    type: 'Prospect',
    company: C.clean(r.company || r.name, 120),
    name: C.clean(r.contact, 80),
    phone: C.clean(r.phone, 24), phone2: C.clean(r.phone2, 24),
    location: C.clean(r.city, 60) || 'Jaipur', area: C.clean(r.area, 80),
    category: CATS.includes(r.category) ? r.category : '',
    priority: ['A', 'B', 'C'].includes(r.priority) ? r.priority : 'B',
    products: C.clean(r.products, 160), why: C.clean(r.why, 300), size: C.clean(r.size, 20),
    relay: !!r.relay, source: C.clean(r.source, 300),
    status, notes: C.clean(r.notes, 1000), follow: isDate(r.follow) ? r.follow : '', owner: C.clean(r.owner, 60),
    date: C.today(), ts: now, addedBy: by, log: []
  };
  if (status !== 'New' || lead.notes) lead.log.push({ t: now, by, type: 'import', status, note: lead.notes });
  if (status !== 'New') { lead.lastAt = now; lead.lastBy = by; }
  return lead;
}

exports.handler = C.handler(async event => {
  if (event.httpMethod !== 'POST') throw C.httpErr(405, 'Method not allowed');
  const u = await C.getUser(event);
  const role = await C.roleOf(u);
  if (!C.canStaff(role)) throw C.httpErr(403, 'Only the APAR team can add leads. Sign in again and retry.');
  const b = C.body(event), db = C.db(), by = String(u.email || '').toLowerCase(), now = Date.now();

  if (b.action === 'add') {
    const lead = toLead(b.lead || {}, by, now);
    if (!lead.company && !lead.phone) throw C.httpErr(400, 'Please enter the business name or phone number.');
    const ref = await db.collection('leads').add(lead);
    return { ok: true, id: ref.id };
  }

  if (b.action === 'import') {
    const rows = Array.isArray(b.rows) ? b.rows.slice(0, 500) : [];
    const mode = b.mode === 'skip' ? 'skip' : 'update';
    const snap = await db.collection('leads').select('phone', 'phone2', 'relay').get();
    const byPhone = new Map();
    snap.docs.forEach(d => { const x = d.data(); if (x.relay) return; [x.phone, x.phone2].forEach(p => { const k = key10(p); if (k && !byPhone.has(k)) byPhone.set(k, d.id); }); });
    const seen = new Set(); let added = 0, updated = 0, skipped = 0;
    let batch = db.batch(), ops = 0;
    const flush = async () => { if (ops) { await batch.commit(); batch = db.batch(); ops = 0; } };
    for (const r of rows) {
      const lead = toLead(r, by, now);
      if (!lead.company && !lead.phone) { skipped++; continue; }
      const k = lead.relay ? '' : key10(lead.phone);
      if (k && seen.has(k)) { skipped++; continue; }
      if (k) seen.add(k);
      const id = k && byPhone.get(k);
      if (id) {
        const news = lead.status !== 'New' || lead.notes || lead.follow;
        if (mode === 'skip' || !news) { skipped++; continue; }
        const up = { log: C.FieldValue().arrayUnion({ t: now, by, type: 'import', status: lead.status, note: lead.notes }) };
        if (lead.status !== 'New') { up.status = lead.status; up.lastAt = now; up.lastBy = by; }
        if (lead.notes) up.notes = lead.notes;
        if (lead.follow) up.follow = lead.follow;
        batch.update(db.collection('leads').doc(id), up); updated++;
      } else {
        batch.set(db.collection('leads').doc(), lead); added++;
      }
      if (++ops >= 400) await flush();
    }
    await flush();
    return { ok: true, added, updated, skipped };
  }

  throw C.httpErr(400, 'Unknown action.');
});
