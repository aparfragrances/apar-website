// Anonymous visitor counting for the APAR admin (no cookies, no personal data).
// The browser sends small events; we only add to daily totals in stats/<YYYY-MM-DD>.
import * as C from '../../cf/lib/core.js';

const PAGES = new Set(['home', 'shop', 'product', 'cart', 'checkout', 'order', 'payfail', 'account', 'wishlist', 'track', 'gifting', 'story', 'contact', 'faq', 'policy', 'b2b', 'seo']);
const SRC = new Set(['instagram', 'facebook', 'google', 'whatsapp', 'youtube', 'direct', 'other']);
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp\/|headless|lighthouse|pingdom|uptime/i;
const slug = s => /^[a-z0-9-]{1,60}$/.test(String(s || '')) ? String(s) : '';

export const onRequestPost = async ctx => {
  const ok = new Response(null, { status: 204 });
  try {
    const ua = ctx.request.headers.get('user-agent') || '';
    if (BOT.test(ua)) return ok;
    let b = {};
    try { b = JSON.parse(await ctx.request.text()); } catch (e) { return ok; }
    C.init(ctx.env);
    const inc = C.FieldValue().increment, up = {};
    const add = (k, sub) => { if (sub) { up[k] = up[k] || {}; up[k][sub] = inc(1); } else up[k] = inc(1); };
    if (b.e === 'pv') {
      const page = PAGES.has(b.p) ? b.p : 'home';
      add('pv'); add('pages', page);
      if (b.ns) { add('visits'); add('src', SRC.has(b.src) ? b.src : 'other'); }
      if (b.nv) { add('visitors'); add('dev', b.dev === 'm' ? 'mobile' : 'desktop'); }
      const id = slug(b.id);
      if (page === 'product' && id) { add('prodViews'); add('prodView', id); }
      if (page === 'checkout' && b.first) add('checkout');
      if (page === 'cart' && b.first) add('cartViews');
    } else if (b.e === 'cart') {
      add('cart'); const id = slug(b.id); if (id) add('cartAdd', id);
    } else if (b.e === 'wa') add('wa');
    else if (b.e === 'call') add('calls');
    else return ok;
    await C.db().collection('stats').doc(C.todayISO()).set(up, { merge: true });
  } catch (e) { console.error('track', e && e.message); }
  return ok;
};
