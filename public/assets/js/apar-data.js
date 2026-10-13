(function (root) {
  const U = id => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1400&q=72`;
  const IM = {
    ...(root.APAR_IMG || {}),
    roses: U('1530062063719-e2d6fe70d7b8'), petals: U('1762328501612-af8eac7b5878'),
    cherries: U('1611096265583-5d745206f2a0'), bakery: U('1583338917451-face2751d8d5'), paan: U('1523367270537-ea9ad6aa374e'), dessert: U('1518090878263-90511084a1ba')
  };
  const TBC = 'To be confirmed';
  const CATS = [
    { slug: 'gulkand', name: 'Gulkand', img: IM.gulkand },
    { slug: 'karonda-cherry', name: 'Karonda Cherry', img: IM.cherry },
    { slug: 'tutti-frutti', name: 'Tutti Frutti', img: IM.tutti },
    { slug: 'lacha-tutti-frutti', name: 'Lacha Tutti Frutti', img: IM.lacha },
    { slug: 'lacha-supari', name: 'Lacha Supari', img: IM.supari },
    { slug: 'combos', name: 'Combos & Gifts', img: IM.lineup, pos: '30% 50%' },
    { slug: 'other', name: 'Other Products', img: IM.petals }
  ];
  const PRODUCTS = [
    { id: 'gulkand', code: 'GK', cat: 'gulkand', name: 'APAR Gulkand', img: IM.gulkand, gallery: [IM.gulkand, IM.lineup, IM.roses, IM.petals], featured: true,
      short: 'Rose preserve. A timeless Indian favourite, thoughtfully crafted for today\'s generation.', uses: 'With milk, desserts, ice cream or paan.',
      v: [['250 g', 250, 199, 169, 40], ['400 g', 400, 299, 249, 60], ['1 kg', 1000, 649, 549, 12]] },
    { id: 'karonda-cherry', code: 'KC', cat: 'karonda-cherry', name: 'APAR Karonda Cherry', img: IM.cherry, gallery: [IM.cherry, IM.lineup, IM.cherries, IM.dessert], featured: true,
      short: 'Sweet and tangy candied karonda cherries for bakes and desserts.', uses: 'Cakes, pastries, ice cream, desserts and confectionery.',
      v: [['200 g', 200, 149, 129, 50], ['500 g', 500, 299, 259, 30], ['1 kg', 1000, 549, 479, 6]] },
    { id: 'tutti-frutti', code: 'TF', cat: 'tutti-frutti', name: 'APAR Tutti Frutti', img: IM.tutti, gallery: [IM.tutti, IM.lineup, IM.bakery], featured: true,
      short: 'Coloured candied fruits. A classic ingredient, crafted for modern kitchens.', uses: 'Cakes, fruit breads, cookies, ice cream, kulfi and paan.',
      v: [['200 g', 200, 99, 85, 80], ['500 g', 500, 199, 169, 45], ['1 kg', 1000, 349, 299, 25]] },
    { id: 'lacha-tutti-frutti', code: 'LT', cat: 'lacha-tutti-frutti', name: 'APAR Lacha Tutti Frutti', img: IM.lacha, gallery: [IM.lacha, IM.lineup, IM.dessert], featured: true,
      short: 'Premium candied strips. Distinctive texture. Unmistakable APAR.', uses: 'Garnish for sweets and desserts, cakes, ice cream and paan.',
      v: [['200 g', 200, 119, 99, 40], ['500 g', 500, 249, 215, 20], ['1 kg', 1000, 449, 389, 10]] },
    { id: 'lacha-supari', code: 'LS', cat: 'lacha-supari', name: 'APAR Lacha Supari', img: IM.supari, gallery: [IM.supari, IM.lineup, IM.paan], featured: true,
      short: 'Premium mouth freshener. Traditional favourites, presented with care.', uses: 'After meals, with paan, or served to guests.',
      v: [['100 g', 100, 149, 129, 35], ['200 g', 200, 269, 229, 18], ['500 g', 500, 599, 519, 0]] },
    { id: 'gulkand-duo', code: 'CB-GD', cat: 'combos', name: 'Gulkand Duo', img: IM.gulkand, gallery: [IM.gulkand, IM.lineup], short: 'Two jars of APAR Gulkand, one to keep and one to share.', uses: 'Gifting and family use.', v: [['2 × 400 g', 800, 598, 469, 20]] },
    { id: 'bakers-trio', code: 'CB-BT', cat: 'combos', name: "Baker's Trio", img: IM.lineup, pos: '55% 50%', gallery: [IM.lineup, IM.cherry, IM.tutti, IM.lacha], short: 'Karonda Cherry, Tutti Frutti and Lacha Tutti Frutti, 500 g each.', uses: 'Home bakers, cake studios and dessert kitchens.', v: [['3 × 500 g', 1500, 747, 599, 15]] },
    { id: 'festive-box', code: 'CB-FB', cat: 'combos', name: 'APAR Festive Gift Box', img: IM.lineup, pos: '20% 50%', gallery: [IM.lineup, IM.gulkand, IM.supari], short: 'All five APAR signature products in one gift box.', uses: 'Festivals, weddings and corporate gifting.', v: [['Gift box · 5 products', 1100, 815, 699, 25]] }
  ];
  PRODUCTS.forEach(p => p.v.forEach(v => { v[5] = 'APR-' + p.code + '-' + v[0].replace('Gift box · 5 products', 'BOX').replace(/[×x]/g, 'X').replace(/\s/g, '').toUpperCase(); }));
  const STORY = [
    'APAR is being developed as a premium Indian food products brand focused on traditional Indian flavours and contemporary premium presentation.',
    'The initial product range includes Gulkand, Karonda Cherry, Tutti Frutti, Lacha Tutti Frutti, Lacha Supari and curated combo/gift products.',
    'The brand aims to combine traditional Indian taste with modern quality standards, premium presentation, attractive packaging and a convenient online shopping experience.'
  ];
  const STATUSES = ['Placed', 'Packed', 'Shipped', 'Out for delivery', 'Delivered', 'Cancelled'];
  const COUPONS = [
    { code: 'APAR10', type: 'pct', value: 10, min: 0, active: true, uses: 0 },
    { code: 'FIRST50', type: 'flat', value: 50, min: 499, active: true, uses: 0 },
    { code: 'FESTIVE15', type: 'pct', value: 15, min: 999, active: false, uses: 0 }
  ];
  const METRO = ['11', '40', '56', '60', '70', '50', '41'];
  function zone(pin) {
    if (!/^\d{6}$/.test(pin || '')) return null;
    if (pin[0] === '3' && pin[1] === '0') return { z: 'A', name: 'Rajasthan', days: '2–3', ship: 39, cod: true };
    if (METRO.includes(pin.slice(0, 2))) return { z: 'B', name: 'Metro', days: '3–5', ship: 49, cod: true };
    if (pin.slice(0, 2) === '79' || pin.slice(0, 2) === '19') return { z: 'D', name: 'Remote', days: '6–9', ship: 79, cod: false };
    return { z: 'C', name: 'Rest of India', days: '4–7', ship: 49, cod: true };
  }
  const FAQ = [
    ['How do I place an order?', 'Add products to your cart, go to checkout, enter your delivery address and pay by UPI, card, net banking or cash on delivery.'],
    ['What are the delivery charges?', 'Delivery is free on orders above ₹499 after discounts. Below that, a small charge based on your PIN code is shown at checkout.'],
    ['How long will delivery take?', 'Enter your PIN code on any product page or at checkout to see the estimated delivery time.'],
    ['Is cash on delivery available?', 'COD is available on most PIN codes for orders up to ₹5,000. Checkout shows whether COD is available for your address.'],
    ['Can I cancel my order?', 'Yes, from My Account until the order is shipped. Prepaid orders are refunded to the original payment method.'],
    ['How do returns work?', 'Delivered orders can be returned from My Account under our Return Policy.'],
    ['Where can I find ingredients and shelf life?', 'They are printed on every pack and will be listed on each product page once confirmed.'],
    ['Do you supply in bulk?', 'Yes. Bakeries, sweet shops, hotels, retailers and distributors can send an enquiry from the B2B page or on WhatsApp.']
  ];
  const POLICIES = { shipping: 'Shipping Policy', returns: 'Return Policy', refund: 'Refund Policy', cancellation: 'Cancellation Policy', privacy: 'Privacy Policy', terms: 'Terms & Conditions' };
  const d = (n) => { const t = new Date(Date.now() - n * 864e5); return t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); };
  const SAMPLE_ORDERS = [
    { id: 'APR204118', date: d(7), name: 'Sample · Riya S.', phone: '9800000001', email: '', city: 'Jaipur', address: 'Sample address', pin: '302001', items: [{ pid: 'gulkand', sku: 'APR-GK-400G', name: 'APAR Gulkand', size: '400 g', qty: 2, price: 249 }], sub: 498, disc: 0, ship: 39, total: 537, pay: 'UPI', payStatus: 'Paid', txn: 'pay_SAMPLE01', si: 4, tracking: 'SR1029384756', courier: 'Sample Courier', refund: '', ret: '', sample: true, events: [] },
    { id: 'APR204171', date: d(4), name: 'Sample · Cake Studio', phone: '9800000002', email: '', city: 'Delhi', address: 'Sample address', pin: '110017', items: [{ pid: 'bakers-trio', sku: 'APR-CB-BT-3X500G', name: "Baker's Trio", size: '3 × 500 g', qty: 2, price: 599 }], sub: 1198, disc: 0, ship: 0, total: 1198, pay: 'Card', payStatus: 'Paid', txn: 'pay_SAMPLE02', si: 2, tracking: 'SR1029384801', courier: 'Sample Courier', refund: '', ret: '', sample: true, events: [] },
    { id: 'APR204203', date: d(1), name: 'Sample · Arjun M.', phone: '9800000003', email: '', city: 'Mumbai', address: 'Sample address', pin: '400050', items: [{ pid: 'festive-box', sku: 'APR-CB-FB-BOX', name: 'APAR Festive Gift Box', size: 'Gift box · 5 products', qty: 1, price: 699 }], sub: 699, disc: 0, ship: 0, total: 699, pay: 'COD', payStatus: 'COD pending', txn: '', si: 0, tracking: '', courier: '', refund: '', ret: '', sample: true, events: [] }
  ];
  root.APAR_DATA = { IM, TBC, CATS, PRODUCTS, STORY, STATUSES, COUPONS, zone, FAQ, POLICIES, SAMPLE_ORDERS, WA: '917851978274',
    CONTACT: { phone: '78519 78274', email: 'aparfragrances@gmail.com', address: '0-33, Amber Towar, Sansar chand Road, Jaipur' } };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.APAR_DATA;
})(typeof window !== 'undefined' ? window : globalThis);
