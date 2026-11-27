// Website visitor totals for the admin (staff only). Returns the last N days of stats/<date>.
import * as C from '../../cf/lib/core.js';

export const onRequest = C.handler(async ({ request }) => {
  const u = await C.getUser(request);
  if (!C.canStaff(await C.roleOf(u))) throw C.httpErr(403, 'Only the APAR team can see visitor numbers.');
  const n = Math.min(120, Math.max(1, Number(new URL(request.url).searchParams.get('days')) || 30));
  const days = Array.from({ length: n }, (_, i) => new Date(Date.now() - i * 864e5).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })).reverse();
  const snaps = await Promise.all(days.map(d => C.db().collection('stats').doc(d).get()));
  return { days: days.map((d, i) => ({ date: d, ...(snaps[i].exists ? snaps[i].data() : {}) })) };
});
