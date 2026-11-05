// Minimal Firestore + Firebase Auth client for Cloudflare (REST API + WebCrypto).
// Mirrors the small part of the firebase-admin API that the APAR backend uses.

const te = new TextEncoder();
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlStr = s => b64url(te.encode(s));
const fromB64url = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
export const b64ToBytes = s => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
export const bytesToB64 = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };

function httpErr(status, message) { const e = new Error(message); e.status = status; return e; }

// ---------- Service-account access token ----------
let tokenCache = null;
async function accessToken(sa) {
  if (tokenCache && tokenCache.exp > Date.now() + 60000 && tokenCache.email === sa.client_email) return tokenCache.token;
  const now = Math.floor(Date.now() / 1000);
  const head = b64urlStr(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64urlStr(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const pem = String(sa.private_key).replace(/\\n/g, '\n').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const key = await crypto.subtle.importKey('pkcs8', b64ToBytes(pem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, te.encode(head + '.' + claim));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + head + '.' + claim + '.' + b64url(sig) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw httpErr(503, 'The store database could not be reached (key problem). Please try again later or order on WhatsApp.');
  tokenCache = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000, email: sa.client_email };
  return j.access_token;
}

// ---------- Value encoding ----------
const SENT = '__apar_sentinel';
export const FieldValue = {
  serverTimestamp: () => ({ [SENT]: 'ts' }),
  arrayUnion: (...values) => ({ [SENT]: 'au', values }),
  bytes: b64 => ({ [SENT]: 'bytes', b64 })
};
const isSent = v => v && typeof v === 'object' && v[SENT];
const isPlain = v => v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !isSent(v);

function enc(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (isSent(v) && v[SENT] === 'bytes') return { bytesValue: v.b64 };
  if (Array.isArray(v)) return { arrayValue: { values: v.filter(x => x !== undefined).map(enc) } };
  const fields = {};
  for (const k of Object.keys(v)) if (v[k] !== undefined) fields[k] = enc(v[k]);
  return { mapValue: { fields } };
}
function dec(v) {
  if (!v) return null;
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('bytesValue' in v) return v.bytesValue;
  if ('referenceValue' in v) return v.referenceValue;
  if ('geoPointValue' in v) return v.geoPointValue;
  if (v.arrayValue) return (v.arrayValue.values || []).map(dec);
  if (v.mapValue) { const o = {}; const f = v.mapValue.fields || {}; for (const k in f) o[k] = dec(f[k]); return o; }
  return null;
}
const seg = s => /^[_a-zA-Z][_a-zA-Z0-9]*$/.test(s) ? s : '`' + String(s).replace(/\\/g, '\\\\').replace(/`/g, '\\`') + '`';

// Split data into plain fields and sentinel transforms; optionally list leaf paths (for merge).
function prepare(data, leafs) {
  const transforms = [], paths = [];
  const walk = (obj, pre, out) => {
    for (const k of Object.keys(obj)) {
      const v = obj[k], p = pre.concat(k), fp = p.map(seg).join('.');
      if (v === undefined) continue;
      if (isSent(v) && v[SENT] === 'ts') { transforms.push({ fieldPath: fp, setToServerValue: 'REQUEST_TIME' }); continue; }
      if (isSent(v) && v[SENT] === 'au') { transforms.push({ fieldPath: fp, appendMissingElements: { values: v.values.map(enc) } }); continue; }
      if (leafs && isPlain(v) && Object.keys(v).length) { out[k] = {}; walk(v, p, out[k]); continue; }
      out[k] = v; paths.push(fp);
    }
  };
  const clean = {}; walk(data, [], clean);
  return { clean, transforms, paths };
}

const autoId = () => { const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', r = crypto.getRandomValues(new Uint8Array(20)); let s = ''; for (const x of r) s += c[x % 62]; return s; };

// ---------- Firestore ----------
export function firestore(env) {
  let sa;
  const raw = env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw httpErr(503, 'The store is still being set up (database key missing). Please try again later or order on WhatsApp.');
  try { sa = JSON.parse(raw); } catch (e) { throw httpErr(503, 'Server configuration error (FIREBASE_SERVICE_ACCOUNT is not valid JSON).'); }
  const pid = sa.project_id;
  const root = `projects/${pid}/databases/(default)/documents`;
  const emu = env.FIRESTORE_EMULATOR_HOST; // local testing only
  const base = (emu ? 'http://' + emu : 'https://firestore.googleapis.com') + '/v1/' + root;

  async function call(method, url, body) {
    const tok = emu ? 'owner' : await accessToken(sa);
    const r = await fetch(url, { method, headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
    if (r.status === 404 && method === 'GET') return null;
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = httpErr(r.status === 409 ? 409 : 500, (j.error && j.error.message) || ('Firestore ' + r.status)); e.fsStatus = j.error && j.error.status; e.internal = true; throw e; }
    return j;
  }

  const snapOf = (ref, doc) => ({ exists: !!doc, id: ref.id, ref, data: () => doc ? dec({ mapValue: { fields: doc.fields || {} } }) : undefined });

  function writeFor(ref, data, opts, kind) {
    const merge = kind === 'set' && opts && opts.merge;
    const { clean, transforms, paths } = prepare(data, merge);
    const w = { update: { name: root + '/' + ref.path, fields: enc(clean).mapValue.fields } };
    if (merge) w.updateMask = { fieldPaths: paths };
    if (kind === 'update') { w.updateMask = { fieldPaths: paths }; w.currentDocument = { exists: true }; }
    if (transforms.length) w.updateTransforms = transforms;
    return w;
  }

  function docRef(path) {
    const parts = path.split('/'), id = parts[parts.length - 1];
    const ref = {
      path, id,
      async get(tx) {
        if (!tx) return snapOf(ref, await call('GET', base + '/' + path));
        const res = await call('POST', base + ':batchGet', { documents: [root + '/' + path], transaction: tx });
        const hit = (res || []).find(x => x.found);
        return snapOf(ref, hit ? hit.found : null);
      },
      set: (data, opts) => call('POST', base + ':commit', { writes: [writeFor(ref, data, opts, 'set')] }),
      update: data => call('POST', base + ':commit', { writes: [writeFor(ref, data, null, 'update')] }),
      delete: () => call('POST', base + ':commit', { writes: [{ delete: root + '/' + path }] })
    };
    return ref;
  }

  function query(coll, q) {
    const self = {
      where(field, op, value) { return query(coll, { ...q, where: { fieldFilter: { field: { fieldPath: field }, op: ({ '==': 'EQUAL', '<': 'LESS_THAN', '>': 'GREATER_THAN' })[op], value: enc(value) } } }); },
      limit(n) { return query(coll, { ...q, limit: n }); },
      select(...f) { return query(coll, { ...q, select: { fields: f.map(x => ({ fieldPath: x })) } }); },
      async get(tx) {
        const sq = { from: [{ collectionId: coll }] };
        if (q.where) sq.where = q.where; if (q.limit) sq.limit = q.limit; if (q.select) sq.select = q.select;
        const res = await call('POST', base + ':runQuery', tx ? { structuredQuery: sq, transaction: tx } : { structuredQuery: sq });
        const docs = (res || []).filter(x => x.document).map(x => { const id = x.document.name.split('/').pop(); return snapOf(docRef(coll + '/' + id), x.document); });
        return { empty: !docs.length, docs, size: docs.length };
      }
    };
    return self;
  }

  function collection(name) {
    const q = query(name, {});
    return {
      ...q,
      doc: id => docRef(name + '/' + (id || autoId())),
      async add(data) { const ref = docRef(name + '/' + autoId()); await ref.set(data); return ref; }
    };
  }

  function batch() {
    const writes = [];
    return {
      set(ref, data, opts) { writes.push(writeFor(ref, data, opts, 'set')); },
      update(ref, data) { writes.push(writeFor(ref, data, null, 'update')); },
      delete(ref) { writes.push({ delete: root + '/' + ref.path }); },
      commit: () => writes.length ? call('POST', base + ':commit', { writes }) : null
    };
  }

  async function runTransaction(fn) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { transaction } = await call('POST', base + ':beginTransaction', {});
      const writes = [];
      const tx = {
        get: refOrQuery => refOrQuery.get(transaction),
        set(ref, data, opts) { writes.push(writeFor(ref, data, opts, 'set')); },
        update(ref, data) { writes.push(writeFor(ref, data, null, 'update')); },
        delete(ref) { writes.push({ delete: root + '/' + ref.path }); }
      };
      let out;
      try { out = await fn(tx); }
      catch (e) { call('POST', base + ':rollback', { transaction }).catch(() => { }); throw e; }
      try { await call('POST', base + ':commit', { writes, transaction }); return out; }
      catch (e) { if (e.fsStatus === 'ABORTED' || e.status === 409) continue; throw e; }
    }
    throw httpErr(503, 'The store is busy. Please try again in a moment.');
  }

  return { projectId: pid, doc: docRef, collection, batch, runTransaction };
}

// ---------- Firebase Auth ID-token check ----------
let jwks = null;
export async function verifyIdToken(token, projectId, env) {
  const [h, p, s] = String(token).split('.');
  const head = JSON.parse(new TextDecoder().decode(fromB64url(h)));
  const pay = JSON.parse(new TextDecoder().decode(fromB64url(p)));
  if (env && env.FIREBASE_AUTH_EMULATOR_HOST && head.alg === 'none') return { ...pay, uid: pay.user_id || pay.sub }; // local testing only
  if (!s) return null;
  const now = Math.floor(Date.now() / 1000);
  if (head.alg !== 'RS256' || pay.aud !== projectId || pay.iss !== 'https://securetoken.google.com/' + projectId || !pay.sub || pay.exp < now || pay.iat > now + 300) return null;
  if (!jwks || jwks.exp < Date.now()) {
    const r = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
    const j = await r.json();
    jwks = { keys: j.keys || [], exp: Date.now() + 3600 * 1000 };
  }
  const jwk = jwks.keys.find(k => k.kid === head.kid);
  if (!jwk) { jwks = null; return null; }
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, fromB64url(s), te.encode(h + '.' + p));
  return ok ? { ...pay, uid: pay.sub } : null;
}
