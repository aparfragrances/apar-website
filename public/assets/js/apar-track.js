/* APAR visitor counter: anonymous daily totals only (no cookies, nothing personal is sent). */
(function () {
  var me = document.currentScript, fixed = me && me.getAttribute('data-page');
  if (navigator.doNotTrack === '1' || /localhost|127\.0\.0\.1/.test(location.hostname) || location.pathname.indexOf('/admin') === 0) return;
  var today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  function get(st, k) { try { return st.getItem(k); } catch (e) { return null; } }
  function put(st, k, v) { try { st.setItem(k, v); } catch (e) {} }
  function send(o) {
    var body = JSON.stringify(o);
    try { if (navigator.sendBeacon && navigator.sendBeacon('/api/track', new Blob([body], { type: 'text/plain' }))) return; } catch (e) {}
    try { fetch('/api/track', { method: 'POST', body: body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }); } catch (e) {}
  }
  function source() {
    var q = location.search.toLowerCase(), r = (document.referrer || '').toLowerCase();
    var m = q.match(/utm_source=([a-z]+)/); var s = m ? m[1] : '';
    if (/fbclid/.test(q)) s = s || 'facebook'; if (/gclid/.test(q)) s = s || 'google';
    if (!s && r && r.indexOf(location.hostname) < 0) s = r;
    if (!s) return 'direct';
    if (/insta|ig/.test(s)) return 'instagram'; if (/facebook|fb\b|fb\.|meta/.test(s)) return 'facebook';
    if (/google/.test(s)) return 'google'; if (/whatsapp|wa\.me/.test(s)) return 'whatsapp'; if (/youtu/.test(s)) return 'youtube';
    return 'other';
  }
  var src = source(), dev = /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'm' : 'd';
  function pv(page, id) {
    var o = { e: 'pv', p: page, id: id || '', src: src, dev: dev };
    if (get(localStorage, 'apar-v') !== today) { o.nv = 1; put(localStorage, 'apar-v', today); }
    if (!get(sessionStorage, 'apar-s')) { o.ns = 1; put(sessionStorage, 'apar-s', '1'); }
    if (page === 'checkout' || page === 'cart') { var k = 'apar-' + page; if (!get(sessionStorage, k)) { o.first = 1; put(sessionStorage, k, '1'); } }
    send(o);
  }
  window.AparTrack = { pv: pv, ev: function (e, id) { send({ e: e, id: id || '' }); } };
  function fromHash() { var h = (location.hash || '').replace(/^#\/?/, '').split('/'); return [h[0] || 'home', decodeURIComponent(h[1] || '')]; }
  if (!fixed) {
    var last = ''; var onHash = function () { var r = fromHash(), k = r.join('/'); if (k === last) return; last = k; pv(r[0], r[1]); };
    onHash(); window.addEventListener('hashchange', onHash);
    // Count add-to-cart once the store script has loaded.
    var tries = 0; (function hook() {
      var S = window.AparStore; if (!S || !S.add) { if (tries++ < 200) setTimeout(hook, 100); return; }
      if (S.__tracked) return; S.__tracked = true; var orig = S.add;
      S.add = function (c, pid) { var r = orig.apply(this, arguments); if (r !== false) send({ e: 'cart', id: pid }); return r; };
    })();
  } else pv(fixed);
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null; if (!a) return;
    var h = a.getAttribute('href') || '';
    if (/wa\.me|whatsapp\.com/.test(h)) send({ e: 'wa' }); else if (/^tel:/.test(h)) send({ e: 'call' });
  }, true);
})();
