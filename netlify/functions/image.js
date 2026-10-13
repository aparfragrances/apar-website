// Serves uploaded product photos at /media/<id> (cached by the CDN).
const { connectLambda, getStore } = require('@netlify/blobs');

exports.handler = async event => {
  const id = String((event.queryStringParameters || {}).id || '').replace(/[^a-z0-9.]/gi, '');
  if (!id) return { statusCode: 404, body: 'Not found' };
  try {
    connectLambda(event);
    const r = await getStore('product-images').getWithMetadata(id, { type: 'arrayBuffer' });
    if (!r) return { statusCode: 404, body: 'Not found' };
    return {
      statusCode: 200,
      headers: { 'Content-Type': (r.metadata && r.metadata.type) || 'image/webp', 'Cache-Control': 'public, max-age=31536000, immutable' },
      body: Buffer.from(r.data).toString('base64'), isBase64Encoded: true
    };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: 'Error' };
  }
};
