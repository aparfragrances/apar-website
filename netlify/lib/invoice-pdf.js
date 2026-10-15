// Builds the same branded APAR PDF invoice on the server (for email attachments).
const fs = require('fs'), path = require('path');
let loaded = null;
function findDir() {
  const tries = [process.env.LAMBDA_TASK_ROOT, process.cwd(), path.join(__dirname, '..'), path.join(__dirname, '../..'), path.join(__dirname, '../../..')].filter(Boolean);
  for (const t of tries) { const d = path.join(t, 'public/assets/pdf'); if (fs.existsSync(path.join(d, 'apar-logo.png'))) return d; }
  throw new Error('invoice assets not found');
}
function setup() {
  if (loaded) return loaded;
  const { jsPDF } = require('jspdf');
  const at = require('jspdf-autotable'); (at.applyPlugin || (at.default && at.default.applyPlugin) || (() => { }))(jsPDF);
  globalThis.jspdf = { jsPDF };
  const d = findDir(), rd = f => fs.readFileSync(path.join(d, f)).toString('base64');
  globalThis.__aparInvoiceAssets = { reg: rd('Poppins_400Regular.ttf'), semi: rd('Poppins_600SemiBold.ttf'), serif: rd('BodoniModa_500Medium.ttf'), logo: 'data:image/png;base64,' + rd('apar-logo.png') };
  loaded = require('../../public/assets/js/apar-invoice.js');
  return loaded;
}
// Returns a Buffer with the PDF, or null if anything fails (email still goes out without it).
async function invoicePdf(order, site, products) {
  try {
    const inv = setup();
    const doc = await inv.build([order], { site: site || {}, products: products || [] });
    return Buffer.from(doc.output('arraybuffer'));
  } catch (e) { console.error('invoice pdf failed', e.message); return null; }
}
module.exports = { invoicePdf };
