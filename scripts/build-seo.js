// Builds search-friendly pages (real URLs like /gulkand/) from the live catalogue.
// Runs on every Netlify deploy; also safe to run locally: node scripts/build-seo.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), PUB = path.join(ROOT, 'public');
const SITE = 'https://aparfragrances.com';
const C = require('./seo-content');

globalThis.window = globalThis;
eval(fs.readFileSync(path.join(PUB, 'assets/js/apar-images.js'), 'utf8'));
const D = require(path.join(PUB, 'assets/js/apar-data.js'));

async function liveCatalog() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return null;
  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
    const snap = await admin.firestore().doc('settings/catalog').get();
    return snap.exists ? snap.data() : null;
  } catch (e) { console.warn('SEO build: using default catalogue (' + e.message + ')'); return null; }
}

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const abs = u => !u ? SITE + '/assets/img/lineup.jpg' : /^https?:/.test(u) ? u : SITE + '/' + String(u).replace(/^\//, '');
const rel = u => !u ? '/assets/img/lineup.jpg' : /^https?:/.test(u) ? u : '/' + String(u).replace(/^\//, '');
const ld = o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;

(async () => {
  const cat = await liveCatalog() || {};
  const px = cat.px || {};
  const fromDb = p => ({ ...p, v: (p.v || []).map(x => Array.isArray(x) ? x : [x.size, Number(x.g) || 0, Number(x.mrp) || 0, Number(x.price) || 0, Number(x.stock) || 0, x.sku || '']) });
  const dbProducts = Array.isArray(cat.products) && cat.products.length ? cat.products.map(fromDb) : null;
  const PRODUCTS = (dbProducts || D.PRODUCTS).filter(p => !p.hidden).map(p => {
    const base = D.PRODUCTS.find(x => x.id === p.id) || {};
    return { ...base, ...p, img: p.img || base.img };
  });
  const vars = p => p.v.map(([size, g, mrp, price, stock, sku], i) => { const o = px[p.id + ':' + i] || {}; return { i, size, sku, mrp: o.mrp ?? mrp, price: o.price ?? price, stock: o.stock ?? stock }; });
  const site = Object.assign({ phone: D.CONTACT.phone, email: D.CONTACT.email, address: D.CONTACT.address, legalName: 'Apar Fragrances' }, cat.site || {});
  const phoneIntl = '+91' + String(site.phone || '').replace(/\D/g, '').slice(-10);
  const WA = 'https://wa.me/' + D.WA;
  const byId = id => PRODUCTS.find(p => p.id === id);
  const pages = [];

  const NAV = [['Shop all', '/#/shop'], ['Gulkand', '/gulkand/'], ['Tutti Frutti', '/tutti-frutti/'], ['Gift Boxes', '/gift-boxes/'], ['Wholesale', '/wholesale/'], ['About', '/about/']];
  const ORG = { '@type': ['Organization', 'LocalBusiness'], '@id': SITE + '/#org', name: 'APAR · Apar Fragrances', legalName: site.legalName, url: SITE + '/', logo: SITE + '/assets/img/logo.webp', image: SITE + '/assets/img/lineup.jpg', telephone: phoneIntl, email: site.email, foundingDate: '2017',
    address: { '@type': 'PostalAddress', streetAddress: site.address, addressLocality: 'Jaipur', addressRegion: 'Rajasthan', addressCountry: 'IN' }, priceRange: '₹₹', sameAs: ['https://m.indiamart.com/aparfragrances'] };

  function layout({ url, title, desc, h1, sub, hindi, body, schema = [], crumbs = [], img }) {
    const canon = SITE + url;
    const bc = { '@type': 'BreadcrumbList', itemListElement: [['Home', '/'], ...crumbs].map(([n, u], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: SITE + u })) };
    const graph = { '@context': 'https://schema.org', '@graph': [ORG, bc, ...schema] };
    return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canon}">
<meta property="og:type" content="website"><meta property="og:site_name" content="APAR"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${canon}"><meta property="og:image" content="${esc(abs(img))}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/img/logo.webp">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Bodoni+Moda:wght@400;500&display=swap">
<link rel="stylesheet" href="/assets/seo.css?v=2">
${ld(graph)}
</head>
<body>
<div class="ann">Free delivery on orders above ₹499 · Cash on delivery available</div>
<header class="hd"><a href="/" class="logo" aria-label="APAR home"><img src="/assets/img/logo.webp" alt="APAR" width="80" height="30"></a>
<nav aria-label="Main">${NAV.map(([l, u]) => `<a href="${u}">${l}</a>`).join('')}</nav>
<a class="cart" href="/#/cart">Cart</a></header>
<main>
<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a>${crumbs.map(([n, u], i) => i === crumbs.length - 1 ? ` <span>›</span> <span aria-current="page">${esc(n)}</span>` : ` <span>›</span> <a href="${u}">${esc(n)}</a>`).join('')}</nav>
<div class="hero"><h1>${esc(h1)}</h1>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}${hindi ? `<p class="hi" lang="hi">${esc(hindi)}</p>` : ''}</div>
${body}
</main>
<footer class="ft"><div class="ftg">
<div><img src="/assets/img/logo.webp" alt="APAR" width="80" height="30" class="flogo"><p>${esc(site.legalName)}<br>${esc(site.address)}<br><a href="tel:${phoneIntl}">${esc(site.phone)}</a> · <a href="mailto:${esc(site.email)}">${esc(site.email)}</a></p>${site.fssai ? `<p>FSSAI Lic. No. ${esc(site.fssai)}</p>` : ''}</div>
<div><h2>Products</h2><a href="/gulkand/">Gulkand</a><a href="/karonda-cherry/">Karonda Cherry</a><a href="/tutti-frutti/">Tutti Frutti</a><a href="/lacha-tutti-frutti/">Lacha Tutti Frutti</a><a href="/lacha-supari/">Lacha Supari</a><a href="/gift-boxes/">Gift Boxes &amp; Combos</a></div>
<div><h2>Guides</h2>${C.guides.map(g => `<a href="/guides/${g.slug}/">${esc(g.h1.replace(/:.*$/, ''))}</a>`).join('')}</div>
<div><h2>Company</h2><a href="/about/">About APAR</a><a href="/wholesale/">Wholesale &amp; Bulk</a><a href="/faq/">FAQs</a><a href="/#/contact">Contact</a><a href="/#/policy/shipping">Shipping Policy</a><a href="/#/policy/privacy">Privacy Policy</a></div>
</div><p class="copy">© ${new Date().getFullYear()} ${esc(site.legalName)}, Jaipur</p></footer>
<a class="wa" href="${WA}" target="_blank" rel="noopener" aria-label="Order on WhatsApp"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.4-4.3a8.5 8.5 0 1 1 15.6-4.5z"/></svg></a>
<script src="/assets/js/seo-live.js?v=2" defer></script>
</body>
</html>
`;
  }

  const priceTable = p => { const vs = vars(p); return `<table class="sizes"><thead><tr><th>Pack</th><th>MRP</th><th>Price</th><th>Availability</th></tr></thead><tbody>${vs.map(v => `<tr><td>${esc(v.size)}</td><td><s data-pid="${p.id}" data-vi="${v.i}" data-f="mrp">${inr(v.mrp)}</s></td><td><strong data-pid="${p.id}" data-vi="${v.i}" data-f="price">${inr(v.price)}</strong></td><td data-pid="${p.id}" data-vi="${v.i}" data-f="stock">${v.stock > 0 ? 'In stock' : 'Out of stock'}</td></tr>`).join('')}</tbody></table>`; };
  const productSchema = (p, url, description) => { const vs = vars(p); return { '@type': 'Product', '@id': SITE + url + '#product', name: p.name, description, image: [abs(p.img), ...(p.gallery || []).slice(0, 3).map(abs)], brand: { '@type': 'Brand', name: 'APAR' }, manufacturer: { '@id': SITE + '/#org' }, sku: (vs[0] || {}).sku || p.id, category: 'Food & Beverages',
    offers: vs.map(v => ({ '@type': 'Offer', name: p.name + ' ' + v.size, sku: v.sku || undefined, price: String(v.price), priceCurrency: 'INR', availability: v.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', itemCondition: 'https://schema.org/NewCondition', url: SITE + url, seller: { '@id': SITE + '/#org' } })) }; };
  const buyBox = (p, desc) => { const vs = vars(p), from = Math.min(...vs.map(v => v.price)); return `<section class="buy"><img src="${esc(rel(p.img))}" alt="${esc(p.name)} pack" width="560" height="560" loading="eager"><div class="bb"><p class="lead">${esc(desc)}</p><p class="from">From <strong data-pid="${p.id}" data-vi="${vs.findIndex(v => v.price === from)}" data-f="price">${inr(from)}</strong></p>${priceTable(p)}<div class="ctas"><a class="btn" href="/#/product/${p.id}">Buy now</a><a class="btn ghost" href="${WA}?text=${encodeURIComponent('Hi APAR, I want to order ' + p.name)}" target="_blank" rel="noopener">Order on WhatsApp</a></div><ul class="trust"><li>Made in Jaipur</li><li>Cash on delivery</li><li>Free delivery above ₹499</li></ul>${p.details ? `<p class="det">${esc(p.details)}</p>` : ''}</div></section>`; };
  const relatedCards = ids => `<section class="rel"><h2>You may also like</h2><div class="cards">${ids.map(byId).filter(Boolean).map(p => { const v = vars(p)[0]; const href = C.products[p.id] ? '/' + C.products[p.id].slug + '/' : p.cat === 'combos' ? '/gift-boxes/#' + p.id : '/#/product/' + p.id; return `<a class="card" href="${href}"><img src="${esc(rel(p.img))}" alt="${esc(p.name)}" width="300" height="300" loading="lazy"><span class="cn">${esc(p.name)}</span><span class="cp">From ${inr(v.price)}</span></a>`; }).join('')}</div></section>`;
  const faqBlock = faqs => `<section class="faq"><h2>Questions about this product</h2>${faqs.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</section>`;
  const faqSchema = faqs => ({ '@type': 'FAQPage', mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });

  // Product pages
  for (const [id, c] of Object.entries(C.products)) {
    const p = byId(id); if (!p) continue;
    const url = '/' + c.slug + '/';
    const body = `${buyBox(p, c.intro[0])}
<section class="prose"><p>${esc(c.intro[1])}</p><h2>${esc(c.whatTitle)}</h2><p>${esc(c.what)}</p><h2>How to use ${esc(c.kw.toLowerCase())}</h2><ul>${c.uses.map(u => `<li>${esc(u)}</li>`).join('')}</ul>
<h2>Why choose APAR ${esc(c.kw)}?</h2><ul><li>Made by Apar Fragrances in Jaipur, crafting traditional Indian flavours since 2017</li>${site.fssai ? `<li>FSSAI licensed (Lic. No. ${esc(site.fssai)})</li>` : '<li>FSSAI licensed manufacturing</li>'}<li>Sealed, attractive packs that are easy to store and gift</li><li>Order online with UPI, cards or cash on delivery, delivered across India</li></ul>
<div class="b2b"><strong>Buying for a business?</strong> Bakeries, sweet shops, hotels and retailers can order ${esc(c.kw.toLowerCase())} in bulk. <a href="/wholesale/">See wholesale supply →</a></div></section>
${faqBlock(c.faqs)}${relatedCards(c.related)}`;
    pages.push({ url, img: p.img, html: layout({ url, title: c.title, desc: c.desc, h1: c.h1, sub: c.sub, hindi: c.hindi, img: p.img, crumbs: [['Products', '/#/shop'], [c.kw, url]], schema: [productSchema(p, url, c.desc), faqSchema(c.faqs)], body }) });
  }

  // Gift boxes
  { const c = C.combos, url = '/' + c.slug + '/'; const combos = PRODUCTS.filter(p => p.cat === 'combos');
    const body = `<section class="prose"><p>${esc(c.intro[0])}</p><p>${esc(c.intro[1])}</p></section>${combos.map(p => `<div id="${p.id}"><h2 class="ph2">${esc(p.name)}</h2>${buyBox(p, p.short || '')}</div>`).join('')}
<section class="b2b wide"><strong>Corporate or wedding orders?</strong> We make custom gift quantities for companies, weddings and festivals. <a href="${WA}?text=${encodeURIComponent('Hi APAR, I want to enquire about gift boxes in bulk')}" target="_blank" rel="noopener">Message us on WhatsApp →</a></section>`;
    pages.push({ url, img: (combos[0] || {}).img, html: layout({ url, title: c.title, desc: c.desc, h1: c.h1, sub: c.sub, hindi: c.hindi, img: (combos[combos.length - 1] || {}).img, crumbs: [['Gift Boxes', url]], schema: combos.map(p => productSchema(p, url + '#' + p.id, p.short || p.name)), body }) }); }

  // Wholesale
  { const c = C.wholesale, url = '/' + c.slug + '/'; const items = Object.values(C.products).map(x => byId(Object.keys(C.products).find(k => C.products[k] === x))).filter(Boolean);
    const body = `<section class="prose"><p><strong>${esc(site.legalName)}</strong> is a Jaipur-based manufacturer and supplier of traditional Indian sweet ingredients and mouth fresheners, established in 2017. Under our APAR brand we make gulkand, tutti frutti, lacha tutti frutti, karonda cherry and lacha supari for homes and businesses across India.</p>
<h2>What we supply in bulk</h2></section><div class="cards wcards">${items.map(p => `<a class="card" href="/${C.products[p.id].slug}/"><img src="${esc(rel(p.img))}" alt="${esc(p.name)} wholesale" width="300" height="300" loading="lazy"><span class="cn">${esc(p.name.replace(/^APAR /, ''))}</span><span class="cp">${esc(p.uses || '')}</span></a>`).join('')}</div>
<section class="prose"><h2>Who we work with</h2><ul><li>Bakeries, cake studios and home bakers</li><li>Sweet shops and mithai makers</li><li>Ice cream, kulfi and dessert parlours</li><li>Paan shops and mouth freshener retailers</li><li>Hotels, restaurants and caterers</li><li>Distributors, wholesalers and grocery stores</li></ul>
<h2>Why businesses choose APAR</h2><ul><li>Direct from the manufacturer in Jaipur</li><li>Consistent quality, colour and cut, batch after batch</li><li>Retail packs and bulk packs</li>${site.gstin ? `<li>GST invoice on every order (GSTIN ${esc(site.gstin)})</li>` : '<li>GST invoice on every order</li>'}${site.fssai ? `<li>FSSAI Lic. No. ${esc(site.fssai)}</li>` : ''}<li>Delivery across India</li></ul>
<h2>Get a bulk price</h2><p>Tell us the products, quantity and your city. We usually reply the same working day.</p><div class="ctas"><a class="btn" href="/#/b2b">Send a bulk enquiry</a><a class="btn ghost" href="${WA}?text=${encodeURIComponent('Hi APAR, I want a bulk price for ')}" target="_blank" rel="noopener">WhatsApp ${esc(site.phone)}</a></div>
<h2>Visit or contact us</h2><p>${esc(site.legalName)}<br>${esc(site.address)}<br>Phone: <a href="tel:${phoneIntl}">${esc(site.phone)}</a> · Email: <a href="mailto:${esc(site.email)}">${esc(site.email)}</a></p></section>`;
    pages.push({ url, html: layout({ url, title: c.title, desc: c.desc, h1: c.h1, sub: c.sub, hindi: c.hindi, crumbs: [['Wholesale', url]], body }) }); }

  // About
  { const c = C.about, url = '/' + c.slug + '/';
    const body = `<section class="prose"><p>APAR is the consumer brand of <strong>${esc(site.legalName)}</strong>, a family business in Jaipur, Rajasthan, that has been making traditional Indian sweet ingredients and mouth fresheners since 2017.</p>${(D.STORY || []).map(t => `<p>${esc(t)}</p>`).join('')}
<h2>Our products</h2><ul>${Object.values(C.products).map(x => `<li><a href="/${x.slug}/">${esc(x.h1)}</a>: ${esc(x.sub)}</li>`).join('')}<li><a href="/gift-boxes/">Gift boxes and combos</a></li></ul>
<h2>Contact</h2><p>${esc(site.address)}<br><a href="tel:${phoneIntl}">${esc(site.phone)}</a> · <a href="mailto:${esc(site.email)}">${esc(site.email)}</a>${site.gstin ? '<br>GSTIN ' + esc(site.gstin) : ''}${site.fssai ? '<br>FSSAI Lic. No. ' + esc(site.fssai) : ''}</p></section>`;
    pages.push({ url, html: layout({ url, title: c.title, desc: c.desc, h1: c.h1, sub: c.sub, crumbs: [['About', url]], body }) }); }

  // FAQ
  { const c = C.faq, url = '/' + c.slug + '/'; const all = [...D.FAQ, ...Object.values(C.products).flatMap(x => x.faqs.slice(0, 1))];
    pages.push({ url, html: layout({ url, title: c.title, desc: c.desc, h1: c.h1, crumbs: [['FAQs', url]], schema: [faqSchema(all)], body: `<section class="faq">${all.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</section>` }) }); }

  // Guides
  for (const g of C.guides) {
    const url = '/guides/' + g.slug + '/', p = byId(g.product), img = D.IM[g.img] || (p && p.img);
    const part = ([t, v]) => t === 'p' ? `<p>${esc(v)}</p>` : t === 'h2' ? `<h2>${esc(v)}</h2>` : `<${t}>${v.map(x => `<li>${esc(x)}</li>`).join('')}</${t}>`;
    const cta = p ? `<div class="b2b"><strong>Get ${esc(p.name)}</strong> delivered across India. <a href="/${(C.products[p.id] || {}).slug || ''}/">See sizes and prices →</a></div>` : '';
    const art = { '@type': 'Article', headline: g.h1, description: g.desc, image: abs(img), author: { '@id': SITE + '/#org' }, publisher: { '@id': SITE + '/#org' }, mainEntityOfPage: SITE + url, datePublished: '2026-10-19' };
    pages.push({ url, html: layout({ url, title: g.title, desc: g.desc, h1: g.h1, img, crumbs: [['Guides', '/guides/' + C.guides[0].slug + '/'], [g.h1.replace(/:.*$/, ''), url]], schema: [art], body: `<article class="prose"><img class="gimg" src="${esc(rel(img))}" alt="${esc(g.h1)}" width="900" height="500" loading="eager">${g.body.map(part).join('')}${cta}</article>${p && C.products[p.id] ? relatedCards(C.products[p.id].related) : ''}` }) });
  }

  // Write pages + sitemap
  for (const pg of pages) { const dir = path.join(PUB, pg.url); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'index.html'), pg.html); }
  const today = new Date().toISOString().slice(0, 10);
  const urls = ['/', ...pages.map(p => p.url)];
  fs.writeFileSync(path.join(PUB, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod><priority>${u === '/' ? '1.0' : u.startsWith('/guides') ? '0.6' : '0.8'}</priority></url>`).join('\n')}\n</urlset>\n`);
  console.log('SEO build: wrote ' + pages.length + ' pages' + (cat.px ? ' (live prices)' : ' (default prices)'));
})().catch(e => { console.error('SEO build failed (site still deploys):', e); process.exit(0); });
