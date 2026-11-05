// Tells the admin app which team role the signed-in person has (owner / admin / staff).
import * as C from '../../cf/lib/core.js';

export const onRequest = C.handler(async ({ request }) => {
  const u = await C.getUser(request);
  if (!u) throw C.httpErr(401, 'Please sign in again.');
  return { email: String(u.email || '').toLowerCase(), verified: u.email_verified === true, role: await C.roleOf(u) };
});
