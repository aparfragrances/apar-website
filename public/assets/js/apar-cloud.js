// APAR cloud layer: Firebase login + database sync + secure checkout (Razorpay via Netlify functions).
(function () {
  const ADMIN_EMAILS = ['aparfragrances@gmail.com'];
  const API = '/.netlify/functions/';
  const GUEST_KEY = 'apar-guest-orders';
  const LINK_KEY = 'apar-link-email';
  const S = () => window.AparStore;
  const D = () => window.APAR_DATA;
  const warn = e => console.warn('[apar-cloud]', e && (e.message || e));

  const M = { orders: new Map(), reviews: new Map(), leads: new Map(), hist: new Set(), px: null, coupons: null, user: null };
  let app = null, auth = null, db = null, comp = null, unsubUser = [], unsubAdmin = [], pendingName = '';

  const C = { M };
  C.available = () => !!db;

  function lsGet(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { } }
  const guestOrders = () => lsGet(GUEST_KEY, []);
  function saveGuest(o) { lsSet(GUEST_KEY, [o, ...guestOrders().filter(x => x.id !== o.id)].slice(0, 20)); }

  const isAdminUser = u => !!u && u.emailVerified && ADMIN_EMAILS.includes(String(u.email || '').toLowerCase());
  C.isAdminUser = isAdminUser;

  async function api(name, payload, method) {
    let t = null;
    try { if (auth && auth.currentUser) t = await auth.currentUser.getIdToken(); } catch (e) { }
    const r = await fetch(API + name, {
      method: method || 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, t ? { Authorization: 'Bearer ' + t } : {}),
      body: payload ? JSON.stringify(payload) : undefined
    });
    let j = {};
    try { j = await r.json(); } catch (e) { }
    if (!r.ok) throw new Error(j.error || (r.status === 404 ? 'The store server is not connected yet. Please order on WhatsApp for now.' : 'Something went wrong. Please try again.'));
    return j;
  }
  C.api = api;

  const authMsg = code => ({
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/wrong-password': 'Incorrect email or password.',
    'auth/user-not-found': 'No account found with this email. Please sign up.',
    'auth/email-already-in-use': 'An account with this email already exists. Please sign in instead.',
    'auth/weak-password': 'Please choose a password with at least 6 characters.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/missing-email': 'Please enter your email address.',
    'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
    'auth/operation-not-allowed': 'This sign-in method is not switched on yet. Please try another method.',
    'auth/unauthorized-domain': 'This website address is not yet allowed for sign-in (add it under Firebase → Authentication → Settings → Authorized domains).',
    'auth/invalid-action-code': 'This sign-in link has expired or was already used. Please request a new one.',
    'auth/expired-action-code': 'This sign-in link has expired. Please request a new one.',
    'auth/network-request-failed': 'Network problem. Please check your internet connection.',
    'auth/popup-blocked': 'Your browser blocked the Google window. Please allow pop-ups and try again.'
  }[code] || 'Sign-in failed. Please try again.');

  function groupReviews(docs) {
    const out = {};
    docs.map(d => ({ _id: d.id, ...d.data() })).sort((a, b) => (a.ts || 0) - (b.ts || 0)).forEach(r => {
      (out[r.pid] = out[r.pid] || []).push(r);
    });
    return out;
  }

  // ---------- Startup ----------
  C.attach = function (c) {
    comp = c;
    comp.setState({ orders: guestOrders() });
    if (!window.firebase || !window.APAR_FIREBASE) { warn('Firebase not loaded'); return; }
    try {
      app = firebase.apps.length ? firebase.app() : firebase.initializeApp(window.APAR_FIREBASE);
      auth = firebase.auth();
      db = firebase.firestore();
    } catch (e) { warn(e); return; }

    completeEmailLink();

    db.doc('settings/catalog').onSnapshot(d => {
      const x = d.exists ? d.data() : {};
      const px = x.px || {}, coupons = Array.isArray(x.coupons) ? x.coupons : D().COUPONS;
      M.px = px; M.coupons = coupons;
      comp.setState({ px, coupons });
    }, warn);

    db.collection('reviews').where('approved', '==', true).onSnapshot(qs => {
      if (comp.state.admin) return;
      comp.setState({ reviews: groupReviews(qs.docs) });
    }, warn);

    auth.onAuthStateChanged(onUser);
  };

  async function onUser(u) {
    unsubUser.forEach(f => f()); unsubUser = [];
    unsubAdmin.forEach(f => f()); unsubAdmin = [];
    if (!u) {
      M.user = null;
      comp.setState({ user: null, admin: false, orders: guestOrders() });
      return;
    }
    const ref = db.doc('users/' + u.uid);
    let data = null;
    try {
      const snap = await ref.get();
      data = snap.exists ? snap.data() : null;
      if (!data) {
        data = { name: pendingName || u.displayName || String(u.email || '').split('@')[0], email: u.email || '', joined: S().today(), addresses: [] };
        await ref.set(data);
      }
    } catch (e) { warn(e); data = data || { name: u.displayName || '', addresses: [] }; }
    pendingName = '';
    const user = { uid: u.uid, name: data.name || u.displayName || '', contact: u.email || '', email: u.email || '', joined: data.joined || '', addresses: data.addresses || [], verified: u.emailVerified };
    M.user = user;
    comp.setState({ user, authErr: '', authMsg: '', authBusy: false, linkPending: false });
    if (location.hash.indexOf('#/account') === 0 || location.hash.indexOf('#/admin') === 0) { /* stay */ }

    if (isAdminUser(u)) { attachAdmin(); return; }

    unsubUser.push(db.collection('orders').where('uid', '==', u.uid).onSnapshot(qs => {
      const mine = qs.docs.map(d => d.data()).sort((a, b) => (b.ts || 0) - (a.ts || 0));
      const ids = new Set(mine.map(o => o.id));
      comp.setState({ orders: [...mine, ...guestOrders().filter(o => !ids.has(o.id))] });
    }, warn));
  }

  function attachAdmin() {
    comp.setState({ admin: true });
    unsubAdmin.push(db.collection('orders').orderBy('ts', 'desc').limit(1000).onSnapshot(qs => {
      M.orders = new Map();
      const orders = qs.docs.map(d => { const o = d.data(); M.orders.set(o.id, o); return o; });
      const txns = orders.filter(o => o.txn).map(o => ({ id: o.txn, order: o.id, amount: o.total, method: o.pay, status: o.payStatus === 'Refunded' ? 'Refunded' : 'Captured', date: o.date, note: 'Verified by Razorpay' }));
      comp.setState({ orders, txns });
    }, warn));
    unsubAdmin.push(db.collection('reviews').onSnapshot(qs => {
      const reviews = groupReviews(qs.docs);
      M.reviews = new Map();
      Object.values(reviews).flat().forEach(r => M.reviews.set(r._id, r));
      comp.setState({ reviews });
    }, warn));
    unsubAdmin.push(db.collection('leads').orderBy('ts', 'desc').limit(500).onSnapshot(qs => {
      M.leads = new Map();
      const leads = qs.docs.map(d => { const l = { _id: d.id, ...d.data() }; M.leads.set(l._id, l); return l; });
      comp.setState({ leads });
    }, warn));
    unsubAdmin.push(db.collection('users').limit(2000).onSnapshot(qs => {
      comp.setState({ users: qs.docs.map(d => { const x = d.data(); return { name: x.name || '', contact: x.email || d.id, joined: x.joined || '', addresses: x.addresses || [] }; }) });
    }, warn));
    unsubAdmin.push(db.collection('inventory_log').orderBy('ts', 'desc').limit(200).onSnapshot(qs => {
      const hist = qs.docs.map(d => d.data());
      M.hist = new Set(hist);
      comp.setState({ hist });
    }, warn));
  }

  // ---------- Save changes made in the page back to the database ----------
  const pick = (o, keys) => keys.reduce((a, k) => { if (o[k] !== undefined) a[k] = o[k]; return a; }, {});
  C.sync = function (c, ps) {
    if (!db || !ps) return;
    const s = c.state;
    if (s.user && s.user.uid && s.user !== ps.user && s.user !== M.user) {
      M.user = s.user;
      db.doc('users/' + s.user.uid).set({ name: s.user.name || '', addresses: s.user.addresses || [] }, { merge: true }).catch(warn);
    }
    if (!s.admin) return;
    const cat = db.doc('settings/catalog');
    if (M.coupons && s.coupons !== ps.coupons && s.coupons !== M.coupons) {
      M.coupons = s.coupons;
      cat.set({ coupons: s.coupons }, { merge: true }).catch(e => { warn(e); S().flash(c, 'Could not save coupons: ' + e.message); });
    }
    if (M.px && s.px !== ps.px && s.px !== M.px) {
      const ch = {};
      Object.keys(s.px).forEach(k => { if (JSON.stringify(s.px[k]) !== JSON.stringify(M.px[k])) ch[k] = s.px[k]; });
      M.px = s.px;
      if (Object.keys(ch).length) cat.set({ px: ch }, { merge: true }).catch(e => { warn(e); S().flash(c, 'Could not save price/stock: ' + e.message); });
    }
    if (s.orders !== ps.orders) s.orders.forEach(o => {
      const m = M.orders.get(o.id);
      if (m && m !== o) {
        M.orders.set(o.id, o);
        db.doc('orders/' + o.id).set(pick(o, ['si', 'payStatus', 'events', 'tracking', 'courier', 'ret', 'refund']), { merge: true }).catch(e => { warn(e); S().flash(c, 'Could not save order: ' + e.message); });
      }
    });
    if (s.hist !== ps.hist) s.hist.forEach(h => {
      if (!M.hist.has(h)) { M.hist.add(h); db.collection('inventory_log').add(Object.assign({}, h, { ts: Date.now() })).catch(warn); }
    });
    if (s.reviews !== ps.reviews) {
      const now = new Map();
      Object.values(s.reviews).flat().forEach(r => { if (r && r._id) now.set(r._id, r); });
      M.reviews.forEach((r, id) => {
        if (!now.has(id)) { M.reviews.delete(id); db.doc('reviews/' + id).delete().catch(warn); }
        else if (now.get(id) !== r) { M.reviews.set(id, now.get(id)); db.doc('reviews/' + id).update({ approved: !!now.get(id).approved }).catch(warn); }
      });
    }
    if (s.leads !== ps.leads) s.leads.forEach(l => {
      const m = l._id && M.leads.get(l._id);
      if (m && m !== l) { M.leads.set(l._id, l); db.doc('leads/' + l._id).update(pick(l, ['status', 'follow', 'owner'])).catch(warn); }
    });
  };

  // ---------- Sign-in ----------
  function completeEmailLink() {
    if (!auth.isSignInWithEmailLink(location.href)) return;
    const email = lsGet(LINK_KEY, '');
    if (!email) {
      comp.setState({ authMode: 'link', linkPending: true, authMsg: 'Please enter the email address you used, to finish signing in.' });
      history.replaceState(null, '', location.pathname + location.search + '#/account');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      return;
    }
    finishLink(email);
  }
  function finishLink(email) {
    comp.setState({ authBusy: true, authErr: '' });
    auth.signInWithEmailLink(email, location.href).then(() => {
      lsDel(LINK_KEY);
      history.replaceState(null, '', location.pathname + '#/account');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }).catch(e => comp.setState({ authBusy: false, authErr: authMsg(e.code) }));
  }

  C.authSubmit = function (c, mode, email, password, name) {
    if (!auth) return c.setState({ authErr: 'Sign-in is not available right now. Please refresh the page.' });
    email = String(email || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return c.setState({ authErr: 'Please enter a valid email address.' });
    const fail = e => c.setState({ authBusy: false, authErr: authMsg(e && e.code) });
    c.setState({ authBusy: true, authErr: '', authMsg: '', authEmail: email });
    if (mode === 'link') {
      if (c.state.linkPending) return finishLink(email);
      auth.sendSignInLinkToEmail(email, { url: location.origin + '/?signin=1', handleCodeInApp: true }).then(() => {
        lsSet(LINK_KEY, email);
        c.setState({ authBusy: false, authMsg: 'Check your inbox: we sent a sign-in link to ' + email + '. Open it on this device to sign in. (Check spam if you don\'t see it.)' });
      }).catch(fail);
      return;
    }
    if (mode === 'signup') {
      pendingName = String(name || '').trim().slice(0, 60);
      auth.createUserWithEmailAndPassword(email, password || '').then(cred => {
        const u = cred.user;
        return Promise.all([u.updateProfile({ displayName: pendingName }).catch(warn), u.sendEmailVerification().catch(warn)]);
      }).then(() => c.setState({ authBusy: false })).catch(fail);
      return;
    }
    auth.signInWithEmailAndPassword(email, password || '').then(() => c.setState({ authBusy: false })).catch(fail);
  };

  C.reset = function (c, email) {
    if (!auth) return;
    email = String(email || '').trim();
    if (!email) return c.setState({ authErr: 'Enter your email above, then tap "Forgot password?".' });
    auth.sendPasswordResetEmail(email).then(() => c.setState({ authErr: '', authMsg: 'Password reset email sent to ' + email + '.' }))
      .catch(e => c.setState({ authErr: authMsg(e.code) }));
  };

  C.google = function (c) {
    if (!auth) return c.setState({ authErr: 'Sign-in is not available right now. Please refresh the page.' });
    const p = new firebase.auth.GoogleAuthProvider();
    p.setCustomParameters({ prompt: 'select_account' });
    c.setState({ authErr: '', authMsg: '' });
    auth.signInWithPopup(p).catch(e => {
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
      if (e.code === 'auth/popup-blocked') return auth.signInWithRedirect(p);
      c.setState({ authErr: authMsg(e.code) });
    });
  };

  C.logout = function () { if (auth) auth.signOut(); };

  // ---------- Reviews, leads, order actions, tracking ----------
  C.addReview = function (r) {
    if (!db || !auth.currentUser) return Promise.reject(new Error('Please sign in first.'));
    return db.collection('reviews').add({ pid: r.pid, uid: auth.currentUser.uid, name: r.name, text: r.text, rating: Math.round(r.rating), date: S().today(), approved: false, ts: Date.now() });
  };
  C.sendLead = f => api('lead', f);
  C.orderAction = function (c, action, id) {
    api('order-action', { action, id }).then(r => {
      c.setState(st => ({ orders: st.orders.map(o => o.id === id ? Object.assign({}, o, r.order) : o) }));
      S().flash(c, action === 'cancel' ? 'Order ' + id + ' cancelled' : 'Return requested for ' + id);
    }).catch(e => S().flash(c, e.message));
  };
  C.track = id => api('track-order?id=' + encodeURIComponent(id), null, 'GET');

  // ---------- Checkout ----------
  let rzpLoading = null;
  function loadRazorpay() {
    if (window.Razorpay) return Promise.resolve();
    if (!rzpLoading) rzpLoading = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = res; s.onerror = () => { rzpLoading = null; rej(new Error('Could not load the payment window. Please check your internet and try again.')); };
      document.head.appendChild(s);
    });
    return rzpLoading;
  }

  function finish(c, order, f, address) {
    if (!c.state.user) saveGuest(order);
    c.setState(st => {
      let user = st.user;
      if (user && f.save && !(user.addresses || []).some(a => a.address === address.address && a.pin === address.pin)) user = Object.assign({}, user, { addresses: [...(user.addresses || []), address] });
      return { paying: false, cart: [], coupon: '', couponMsg: '', orders: [order, ...st.orders.filter(o => o.id !== order.id)], user };
    });
    location.hash = '#/order/' + order.id;
  }

  C.placeOrder = async function (c, f) {
    const s = c.state;
    if (s.paying) return;
    const items = s.cart.map(l => ({ pid: l.pid, vi: l.vi, qty: l.qty }));
    const address = { name: f.name, phone: f.phone, email: f.email || '', address: f.address, city: f.city, pin: f.pin };
    c.setState({ paying: true });
    try {
      const r = await api('create-order', { items, coupon: s.coupon, address, pay: s.pay });
      if (r.mode === 'cod') return finish(c, r.order, f, address);
      await loadRazorpay();
      c.setState({ paying: false });
      const rz = new window.Razorpay({
        key: r.rzp.key, order_id: r.rzp.order_id, amount: r.rzp.amount, currency: 'INR',
        name: 'APAR', description: 'Order payment', image: location.origin + '/assets/img/logo.webp',
        prefill: r.rzp.prefill, theme: { color: '#0f3b2e' },
        handler: async resp => {
          c.setState({ paying: true });
          try {
            const v = await api('verify-payment', Object.assign({ pendingId: r.pendingId }, resp));
            finish(c, v.order, f, address);
          } catch (e) {
            c.setState({ paying: false });
            S().flash(c, e.message);
            location.hash = '#/payfail';
          }
        },
        modal: { ondismiss: () => { c.setState({ paying: false }); S().flash(c, 'Payment cancelled. Your cart is saved.'); } }
      });
      rz.on('payment.failed', () => { c.setState({ paying: false }); });
      rz.open();
    } catch (e) {
      c.setState({ paying: false });
      S().flash(c, e.message);
    }
  };

  window.AparCloud = C;
})();
