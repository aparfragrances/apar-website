// Keeps prices and stock on the guide/product pages in sync with the live catalogue.
(function () {
  var els = document.querySelectorAll('[data-pid][data-vi][data-f]'); if (!els.length) return;
  var URL = 'https://firestore.googleapis.com/v1/projects/apar-471bf/databases/(default)/documents/settings/catalog?key=AIzaSyCz1AcopcIecjUfn2TWu0Fa0x6rvUPPuEY';
  function val(v) { if (!v) return undefined; if ('integerValue' in v) return Number(v.integerValue); if ('doubleValue' in v) return v.doubleValue; if ('stringValue' in v) return v.stringValue; if ('booleanValue' in v) return v.booleanValue;
    if (v.mapValue) { var o = {}, f = v.mapValue.fields || {}; for (var k in f) o[k] = val(f[k]); return o; } if (v.arrayValue) return (v.arrayValue.values || []).map(val); return undefined; }
  var inr = function (n) { return '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN'); };
  fetch(URL).then(function (r) { return r.ok ? r.json() : null; }).then(function (doc) {
    if (!doc || !doc.fields) return;
    var px = val(doc.fields.px) || {}, prods = val(doc.fields.products) || [];
    els.forEach(function (el) {
      var pid = el.getAttribute('data-pid'), vi = el.getAttribute('data-vi'), f = el.getAttribute('data-f');
      var base = {}; prods.forEach(function (p) { if (p && p.id === pid && p.v && p.v[vi]) { var x = p.v[vi]; base = Array.isArray(x) ? { mrp: x[2], price: x[3], stock: x[4] } : x; } });
      var o = Object.assign({}, base, px[pid + ':' + vi] || {}); if (o[f] === undefined) return;
      el.textContent = f === 'stock' ? (Number(o.stock) > 0 ? 'In stock' : 'Out of stock') : inr(o[f]);
    });
  }).catch(function () { });
})();
