// Tells the admin app which team role the signed-in person has (owner / admin / staff),
// checked on the server so a slow or failed browser read never locks a team member out.
const C = require('../lib/core');

exports.handler = C.handler(async event => {
  const u = await C.getUser(event);
  if (!u) throw C.httpErr(401, 'Please sign in again.');
  return { email: String(u.email || '').toLowerCase(), verified: u.email_verified === true, role: await C.roleOf(u) };
});
