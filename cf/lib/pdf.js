// Builds the branded APAR PDF invoice on the server (same design as the website download).
import { jsPDF } from 'jspdf';
import { applyPlugin } from 'jspdf-autotable';
import Invoice from '../../public/assets/js/apar-invoice.js';
import { bytesToB64 } from './fs.js';

let assetsReady = null;
async function loadAssets(fetchAsset) {
  if (assetsReady) return assetsReady;
  assetsReady = (async () => {
    const get = async f => { const r = await fetchAsset('/assets/pdf/' + f); if (!r.ok) throw new Error('asset ' + f + ' ' + r.status); return bytesToB64(new Uint8Array(await r.arrayBuffer())); };
    const [reg, semi, serif, logo] = await Promise.all([get('Poppins_400Regular.ttf'), get('Poppins_600SemiBold.ttf'), get('BodoniModa_500Medium.ttf'), get('apar-logo.png')]);
    return { reg, semi, serif, logo: 'data:image/png;base64,' + logo };
  })();
  assetsReady.catch(() => { assetsReady = null; });
  return assetsReady;
}

// Returns Uint8Array with the PDF, or null on failure (the email still goes out without it).
export async function invoicePdf(order, site, products, fetchAsset) {
  try {
    applyPlugin(jsPDF);
    globalThis.jspdf = { jsPDF };
    globalThis.__aparInvoiceAssets = await loadAssets(fetchAsset);
    const inv = Invoice || globalThis.AparInvoice;
    const doc = await inv.build([order], { site: site || {}, products: products || [] });
    return new Uint8Array(doc.output('arraybuffer'));
  } catch (e) { console.error('invoice pdf failed', e && e.message); return null; }
}
