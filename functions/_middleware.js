// Send www.aparfragrances.com to aparfragrances.com (one address for Google).
export async function onRequest(ctx) {
  const url = new URL(ctx.request.url);
  if (url.hostname === 'www.aparfragrances.com') {
    url.hostname = 'aparfragrances.com';
    return Response.redirect(url.toString(), 301);
  }
  return ctx.next();
}
