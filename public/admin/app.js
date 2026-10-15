// APAR Admin — sign-in, layout, navigation and live alerts.
(function () {
  const A = window.AA;
  const { useState, useEffect, useRef } = React;
  const { html, Btn, Icon, cx } = A;

  const NAV = [
    ['dashboard', 'Dashboard', 'dash', 'staff'], ['orders', 'Orders', 'orders', 'staff'], ['products', 'Products', 'box', 'admin'], ['inventory', 'Inventory', 'stock', 'staff'],
    ['customers', 'Customers', 'users', 'staff'], ['payments', 'Payments', 'pay', 'staff'], ['coupons', 'Coupons', 'tag', 'admin'], ['reviews', 'Reviews', 'star', 'staff'],
    ['leads', 'B2B leads', 'lead', 'staff'], ['shipping', 'Shipping', 'truck', 'admin'], ['settings', 'Settings', 'gear', 'admin']
  ];
  const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', staff: 'Staff' };

  // ---------- sound + browser notification for new orders ----------
  function chime() {
    try {
      const C = new (window.AudioContext || window.webkitAudioContext)();
      [880, 1175, 1568].forEach((f, i) => { const o = C.createOscillator(), g = C.createGain(); o.frequency.value = f; o.connect(g); g.connect(C.destination); const t = C.currentTime + i * 0.16; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); o.start(t); o.stop(t + 0.4); });
    } catch (e) { }
  }

  // ---------- sign-in screen ----------
  function Login({ err: initialErr }) {
    const [mode, setMode] = useState('google'), [email, setEmail] = useState(''), [pw, setPw] = useState('');
    const [msg, setMsg] = useState(''), [err, setErr] = useState(initialErr || ''), [busy, setBusy] = useState(false);
    const fail = e => { setBusy(false); setErr(({ 'auth/invalid-credential': 'Incorrect email or password.', 'auth/user-not-found': 'No account with this email.', 'auth/too-many-requests': 'Too many attempts. Wait a few minutes.', 'auth/unauthorized-domain': 'This address is not allowed yet: add it in Firebase → Authentication → Settings → Authorized domains.', 'auth/operation-not-allowed': 'This sign-in method is not switched on in Firebase.' })[e.code] || e.message); };
    const google = () => { setErr(''); const p = new firebase.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' }); A.auth.signInWithPopup(p).catch(e => { if (e.code === 'auth/popup-blocked') return A.auth.signInWithRedirect(p); if (!/popup-closed|cancelled-popup/.test(e.code)) fail(e); }); };
    const link = () => {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setErr('Enter your email address.');
      setBusy(true); setErr('');
      A.auth.sendSignInLinkToEmail(email, { url: location.origin + '/admin/', handleCodeInApp: true }).then(() => { try { localStorage.setItem('apar-admin-link', email); } catch (e) { } setBusy(false); setMsg('Sign-in link sent to ' + email + '. Open it on this device.'); }).catch(fail);
    };
    const pass = () => { setBusy(true); setErr(''); A.auth.signInWithEmailAndPassword(email, pw).catch(fail); };
    return html`<div className="login"><div className="login-card">
      <div className="brandmark">APAR</div><h1>Admin</h1><p className="muted">Sign in with your store account to manage orders, products and customers.</p>
      <div className="seg">${[['google', 'Google'], ['link', 'Email link'], ['pass', 'Password']].map(([k, l]) => html`<button key=${k} className=${mode === k ? 'on' : ''} onClick=${() => { setMode(k); setErr(''); setMsg(''); }}>${l}</button>`)}</div>
      ${mode === 'google' && html`<${Btn} kind="primary" onClick=${google}>Continue with Google</${Btn}>`}
      ${mode !== 'google' && html`<input type="email" value=${email} onChange=${e => setEmail(e.target.value)} placeholder="Email address" autoComplete="email" />`}
      ${mode === 'pass' && html`<input type="password" value=${pw} onChange=${e => setPw(e.target.value)} placeholder="Password" autoComplete="current-password" onKeyDown=${e => e.key === 'Enter' && pass()} />`}
      ${mode === 'link' && html`<${Btn} kind="primary" disabled=${busy} onClick=${link}>${busy ? 'Sending…' : 'Email me a sign-in link'}</${Btn}>`}
      ${mode === 'pass' && html`<${Btn} kind="primary" disabled=${busy} onClick=${pass}>${busy ? 'Signing in…' : 'Sign in'}</${Btn}>`}
      ${msg && html`<div className="ok-msg">${msg}</div>`}${err && html`<div className="err-msg">${err}</div>`}
      <a className="sub" href="/">← Back to the store</a></div></div>`;
  }

  function NoAccess({ user, role }) {
    return html`<div className="login"><div className="login-card"><div className="brandmark">APAR</div><h1>No admin access</h1>
      <p className="muted">${role === 'unverified' ? 'Please verify your email first (check your inbox), or sign in with Google.' : 'You are signed in as ' + user.email + ', which is not on the APAR team. Ask the owner to add you in Settings → Team.'}</p>
      <${Btn} kind="primary" onClick=${() => A.auth.signOut()}>Sign in with another account</${Btn}><a className="sub" href="/">← Back to the store</a></div></div>`;
  }

  // ---------- main shell ----------
  function Shell({ user, role }) {
    const [data, setData] = useState({ ready: {} });
    const [menu, setMenu] = useState(false), [order, setOrder] = useState(null), [q, setQ] = useState('');
    const [alerts, setAlerts] = useState(() => { try { return localStorage.getItem('apar-admin-alerts') !== 'off'; } catch (e) { return true; } });
    const alertsRef = useRef(alerts); alertsRef.current = alerts;
    const h = A.useHash();
    const page = h[0] || 'dashboard', sub = h[1] || '';
    useEffect(() => A.subscribe(role, setData, o => {
      A.toast('🛒 New order ' + o.id + ' · ' + A.inr(o.total) + ' · ' + o.name, 'ok');
      if (alertsRef.current) { chime(); try { if (window.Notification && Notification.permission === 'granted') new Notification('New APAR order ' + o.id, { body: A.inr(o.total) + ' · ' + o.name + ' · ' + o.city, icon: '/assets/img/logo.webp' }); } catch (e) { } }
    }), [role]);
    useEffect(() => { setMenu(false); setOrder(null); window.scrollTo(0, 0); }, [page, sub]);
    useEffect(() => { document.title = (NAV.find(n => n[0] === page) || ['', 'Admin'])[1] + ' · APAR Admin'; }, [page]);
    const toggleAlerts = () => { const v = !alerts; setAlerts(v); try { localStorage.setItem('apar-admin-alerts', v ? 'on' : 'off'); } catch (e) { } if (v && window.Notification && Notification.permission === 'default') Notification.requestPermission(); A.toast(v ? 'New-order sound & notifications on' : 'New-order alerts off'); };
    const isAdmin = A.canAdmin(role);
    const nav = NAV.filter(n => n[3] === 'staff' || isAdmin);
    const allowed = nav.some(n => n[0] === page);
    const newCount = (data.orders || []).filter(o => o.si === 0).length;
    const err = data.ordersError || data.catalogError;
    const openOrder = id => setOrder(id);
    const props = { data, role, openOrder };
    const search = e => { e.preventDefault(); const v = q.trim(); if (!v) return; const hit = (data.orders || []).find(o => o.id === v.toUpperCase()); if (hit) setOrder(hit.id); else { A.go('orders/all'); setTimeout(() => window.dispatchEvent(new CustomEvent('aa-search', { detail: v })), 0); } };
    const [ordersQuery, setOrdersQuery] = useState('');
    useEffect(() => { const f = e => setOrdersQuery(e.detail + ' '); window.addEventListener('aa-search', f); return () => window.removeEventListener('aa-search', f); }, []);
    let body;
    if (!data.ready.catalog || !data.ready.orders) body = err ? html`<div className="page"><div className="alert">Could not load data: ${err}. Check that the latest Firestore rules are published.</div></div>` : html`<div className="loading"><span className="spin"></span>Loading your store…</div>`;
    else if (!allowed) body = html`<div className="page"><div className="alert grey">This section is only for admins.</div></div>`;
    else body = {
      dashboard: html`<${A.Dashboard} ...${props} />`, orders: html`<${A.Orders} ...${props} tab=${sub || 'all'} query=${ordersQuery.trim()} />`,
      products: sub ? html`<${A.ProductEditor} ...${props} id=${sub} />` : html`<${A.Products} ...${props} />`, inventory: html`<${A.Inventory} ...${props} />`,
      customers: html`<${A.Customers} ...${props} />`, payments: html`<${A.Payments} ...${props} />`, coupons: html`<${A.Coupons} ...${props} />`, reviews: html`<${A.Reviews} ...${props} />`,
      leads: html`<${A.Leads} ...${props} />`, shipping: html`<${A.Shipping} ...${props} />`, settings: html`<${A.Settings} ...${props} />`
    }[page];

    return html`<div className=${cx('shell', menu && 'menu-open')}>
      <aside className="side"><div className="side-top"><a className="logo" href="#/dashboard"><span className="brandmark sm">APAR</span><span className="logo-t">Admin</span></a><button className="icon-btn only-m" onClick=${() => setMenu(false)} aria-label="Close menu"><${Icon} n="x" /></button></div>
        <nav>${nav.map(([k, l, ic]) => html`<a key=${k} href=${'#/' + k} className=${cx('nav', page === k && 'on')}><${Icon} n=${ic} /><span>${l}</span>${k === 'orders' && newCount > 0 && html`<span className="nav-n">${newCount}</span>`}${k === 'reviews' && (data.reviews || []).some(r => !r.approved) && html`<span className="nav-dot"></span>`}</a>`)}</nav>
        <div className="side-foot"><a className="nav" href="/" target="_blank"><${Icon} n="store" /><span>View store</span></a></div></aside>
      <div className="scrim" onClick=${() => setMenu(false)}></div>
      <div className="main">
        <header className="top"><button className="icon-btn only-m" onClick=${() => setMenu(true)} aria-label="Open menu"><${Icon} n="menu" /></button>
          <form className="top-search" onSubmit=${search}><${Icon} n="search" s=${16} /><input value=${q} onChange=${e => setQ(e.target.value)} placeholder="Find order ID, name or phone…" aria-label="Search" /></form>
          <button className=${cx('icon-btn', alerts && 'on')} onClick=${toggleAlerts} title=${alerts ? 'New-order alerts on' : 'New-order alerts off'} aria-label="New-order alerts"><${Icon} n="bell" />${newCount > 0 && html`<span className="bell-n">${newCount}</span>`}</button>
          <div className="who"><div className="who-n">${user.displayName || user.email}</div><div className="who-r">${ROLE_LABEL[role]} · <button className="link" onClick=${() => A.auth.signOut()}>Sign out</button></div></div></header>
        <main>${body}</main>
      </div>
      <${A.OrderDrawer} data=${data} id=${order} onClose=${() => setOrder(null)} />
    </div>`;
  }

  function App() {
    const [st, setSt] = useState({ phase: 'loading' });
    useEffect(() => {
      try { A.init(); } catch (e) { setSt({ phase: 'error', err: e.message }); return; }
      if (A.auth.isSignInWithEmailLink(location.href)) {
        let em = ''; try { em = localStorage.getItem('apar-admin-link') || ''; } catch (e) { }
        if (em) A.auth.signInWithEmailLink(em, location.href).then(() => history.replaceState(null, '', '/admin/')).catch(e => setSt({ phase: 'login', err: e.message }));
      }
      return A.auth.onAuthStateChanged(async u => {
        if (!u) return setSt({ phase: 'login' });
        setSt({ phase: 'loading' });
        const role = await A.roleOf(u);
        setSt(role && role !== 'unverified' ? { phase: 'in', user: u, role } : { phase: 'denied', user: u, role });
      });
    }, []);
    const hosts = html`<${A.ToastHost} /><${A.ConfirmHost} /><${A.AskHost} />`;
    if (st.phase === 'loading') return html`<div className="loading full"><span className="spin"></span>Opening APAR Admin…</div>`;
    if (st.phase === 'error') return html`<div className="loading full">${st.err}</div>`;
    if (st.phase === 'login') return html`<${Login} err=${st.err} />${hosts}`;
    if (st.phase === 'denied') return html`<${NoAccess} user=${st.user} role=${st.role} />${hosts}`;
    return html`<${Shell} user=${st.user} role=${st.role} />${hosts}`;
  }

  ReactDOM.createRoot(document.getElementById('root')).render(html`<${App} />`);
})();
