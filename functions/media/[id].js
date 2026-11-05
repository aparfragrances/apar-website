// Serves uploaded product photos at /media/<id>, cached at Cloudflare's edge.
import * as C from '../../cf/lib/core.js';
import { b64ToBytes } from '../../cf/lib/fs.js';

export async function onRequestGet(ctx) {
  const { request, env, params, waitUntil } = ctx;
  const id = String(params.id || '').replace(/[^a-z0-9.]/gi, '');
  if (!id) return new Response('Not found', { status: 404 });
  const cache = caches.default, key = new Request(new URL('/media/' + id, request.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;
  // A photo saved as a file in the site (public/media/...) wins.
  const asset = await env.ASSETS.fetch(key);
  if (asset.ok) return asset;
  try {
    C.init(env);
    const snap = await C.db().collection('media').doc(id).get();
    if (!snap.exists) return new Response('Not found', { status: 404 });
    const d = snap.data();
    const res = new Response(b64ToBytes(d.data), { headers: { 'Content-Type': d.type || 'image/webp', 'Cache-Control': 'public, max-age=31536000, immutable' } });
    waitUntil(cache.put(key, res.clone()));
    return res;
  } catch (e) { console.error(e && e.message); return new Response('Error', { status: 500 }); }
}
