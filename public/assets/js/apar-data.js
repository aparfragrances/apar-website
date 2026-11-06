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
  // Policy text. Contact: 78519 78274 · aparfragrances@gmail.com. Seller: Apar Fragrances, Jaipur.
  const HELP = 'WhatsApp or call 78519 78274, or email aparfragrances@gmail.com';
  const POLICY_TEXT = {
    shipping: [
      ['Where we deliver', 'We deliver across India through trusted courier partners. Enter your PIN code on any product page or at checkout to see if we deliver to you and the expected delivery time.'],
      ['Dispatch time', 'Orders are packed and handed to the courier within 1–2 working days (Monday to Saturday, except public holidays). Orders placed on Sunday or a holiday are dispatched the next working day.'],
      ['Delivery time', 'Rajasthan: usually 2–3 days. Metro cities: 3–5 days. Rest of India: 4–7 days. Remote areas (including J&K and the North East): 6–9 days. These are estimates after dispatch; weather, festivals or courier delays can add a few days.'],
      ['Delivery charges', 'Delivery is free on orders of ₹499 or more (after discounts). For smaller orders, a small charge based on your PIN code is shown at checkout before you pay.'],
      ['Cash on Delivery', 'COD is available on most PIN codes for orders up to ₹5,000. Checkout shows whether COD is available for your address.'],
      ['Tracking', 'Once your order ships, the courier name and tracking number appear in My Account and on the Track Order page. We also send updates by email and WhatsApp.'],
      ['Wrong address or failed delivery', 'Please check your address and mobile number before placing the order. If a parcel is returned because of a wrong address or the customer was unavailable, re-shipping charges may apply. Refused COD orders may block COD for future orders.'],
      ['Need help?', HELP + '.']
    ],
    returns: [
      ['Food items cannot be returned once opened', 'Our products are food items, so for hygiene and safety we cannot accept returns of opened or used products, or returns because of change of mind or taste preference.'],
      ['When we will replace or refund', 'We will replace the product or give a full refund if you received: a damaged or leaking pack, a wrong product or size, a missing item, or a product past its expiry date.'],
      ['How to report a problem', 'Report it within 48 hours of delivery from My Account (Return / Replace), or on WhatsApp at 78519 78274, with your order number and clear photos of the product, the pack and the outer box. An unboxing video helps us resolve it faster.'],
      ['What happens next', 'We review your request within 1–2 working days. If approved, we send a replacement at no extra cost, or refund you as per our Refund Policy. If we need the item back, we arrange the pickup.'],
      ['Bulk and B2B orders', 'Bulk, wholesale and custom gifting orders are covered by the terms agreed in your quotation.']
    ],
    refund: [
      ['When you get a refund', 'You get a refund when an order is cancelled before dispatch, when a prepaid order cannot be delivered, or when a return or replacement request is approved and a replacement is not possible.'],
      ['How long it takes', 'Approved refunds are started within 2 working days. Online payments (UPI, card, net banking, wallet) go back to the original payment method and usually reach you in 5–7 working days, depending on your bank.'],
      ['Cash on Delivery orders', 'For COD orders, we refund to your UPI ID or bank account. We will ask for these details on WhatsApp or email.'],
      ['Delivery charges', 'Delivery charges are refunded when the problem is from our side (damaged, wrong or missing item). They are not refunded for orders cancelled after dispatch.'],
      ['Refund status', 'You can see the refund status on the order in My Account. For help, ' + HELP + '.']
    ],
    cancellation: [
      ['Before dispatch', 'You can cancel your order free of charge from My Account (Cancel order) until it is shipped. Prepaid orders are refunded in full to the original payment method.'],
      ['After dispatch', 'Once an order has shipped it cannot be cancelled. If you refuse a COD parcel, COD may be disabled for your future orders.'],
      ['Cancellation by APAR', 'We may cancel an order if a product is out of stock, the address is not serviceable, the payment fails or looks suspicious, or the price shown was wrong because of a technical error. If you have already paid, you get a full refund.'],
      ['Need help?', HELP + '.']
    ],
    privacy: [
      ['Who we are', 'This website is run by Apar Fragrances, 0-33, Amber Towar, Sansar Chand Road, Jaipur, Rajasthan. This policy explains what personal information we collect and how we use it.'],
      ['What we collect', 'Your name, mobile number, email, delivery addresses and order history when you create an account or place an order; messages you send us; and basic technical data such as device and browser type. We do not store your card, UPI or bank details; payments are handled securely by Razorpay.'],
      ['How we use it', 'To process and deliver your orders, send order and delivery updates (email, SMS or WhatsApp), provide customer support, prevent fraud, keep tax and accounting records, and, only if you opt in, send offers and new launch news.'],
      ['Who we share it with', 'Only with service providers who help us run the store: courier partners (to deliver your order), Razorpay (payments), Google Firebase (secure account and order storage) and Brevo (order emails). We never sell your personal data.'],
      ['Your choices', 'You can update your details and notification preferences in My Account. To get a copy of your data or delete your account, email aparfragrances@gmail.com.'],
      ['Cookies', 'We use essential cookies and browser storage to keep you signed in and remember your cart. Optional analytics are used only if you allow them.'],
      ['Security and retention', 'Your data is stored on secure, encrypted services. We keep order and invoice records for as long as tax laws require.'],
      ['Contact', 'For any privacy question, ' + HELP + '.']
    ],
    terms: [
      ['About these terms', 'By using aparfragrances.com or placing an order, you agree to these terms. The website is run by Apar Fragrances, Jaipur, Rajasthan (GSTIN 08ABHFA9691D1Z6, FSSAI Lic. No. 12217026000698).'],
      ['Products and prices', 'All prices are in Indian Rupees and include GST unless stated otherwise. Product photos are for illustration; packaging may vary slightly. We may change prices, products or offers at any time; the price at the time you place the order applies.'],
      ['Orders', 'An order is confirmed when you receive an order number. We may refuse or cancel an order as described in our Cancellation Policy.'],
      ['Payments', 'Online payments are processed by Razorpay. Cash on Delivery is available on eligible orders. Coupon codes are subject to their own conditions and cannot be exchanged for cash.'],
      ['Food safety', 'Please read the ingredients and allergen information on the pack before use. Store as directed and consume before the best-before date.'],
      ['Use of the website', 'Do not misuse the website, place fake orders or try to break its security. All content, logos and photos belong to APAR and may not be copied without permission.'],
      ['Liability', 'Our responsibility for any order is limited to the amount you paid for that order.'],
      ['Law and jurisdiction', 'These terms are governed by the laws of India. Any dispute is subject to the courts of Jaipur, Rajasthan.'],
      ['Contact', HELP + '.']
    ]
  };
  const d = (n) => { const t = new Date(Date.now() - n * 864e5); return t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); };
  const SAMPLE_ORDERS = [
    { id: 'APR204118', date: d(7), name: 'Sample · Riya S.', phone: '9800000001', email: '', city: 'Jaipur', address: 'Sample address', pin: '302001', items: [{ pid: 'gulkand', sku: 'APR-GK-400G', name: 'APAR Gulkand', size: '400 g', qty: 2, price: 249 }], sub: 498, disc: 0, ship: 39, total: 537, pay: 'UPI', payStatus: 'Paid', txn: 'pay_SAMPLE01', si: 4, tracking: 'SR1029384756', courier: 'Sample Courier', refund: '', ret: '', sample: true, events: [] },
    { id: 'APR204171', date: d(4), name: 'Sample · Cake Studio', phone: '9800000002', email: '', city: 'Delhi', address: 'Sample address', pin: '110017', items: [{ pid: 'bakers-trio', sku: 'APR-CB-BT-3X500G', name: "Baker's Trio", size: '3 × 500 g', qty: 2, price: 599 }], sub: 1198, disc: 0, ship: 0, total: 1198, pay: 'Card', payStatus: 'Paid', txn: 'pay_SAMPLE02', si: 2, tracking: 'SR1029384801', courier: 'Sample Courier', refund: '', ret: '', sample: true, events: [] },
    { id: 'APR204203', date: d(1), name: 'Sample · Arjun M.', phone: '9800000003', email: '', city: 'Mumbai', address: 'Sample address', pin: '400050', items: [{ pid: 'festive-box', sku: 'APR-CB-FB-BOX', name: 'APAR Festive Gift Box', size: 'Gift box · 5 products', qty: 1, price: 699 }], sub: 699, disc: 0, ship: 0, total: 699, pay: 'COD', payStatus: 'COD pending', txn: '', si: 0, tracking: '', courier: '', refund: '', ret: '', sample: true, events: [] }
  ];
  const SHIP_DEFAULT = { free: 499, codMax: 5000, zones: { A: 39, B: 49, C: 49, D: 79 }, cod: { A: true, B: true, C: true, D: false } };
  // Delivery zone with the admin's saved delivery charges applied.
  function quote(pin, sh) {
    const z = zone(pin); if (!z) return null;
    sh = sh || root.APAR_DATA.SHIP || SHIP_DEFAULT;
    const zs = sh.zones || {}, cs = sh.cod || {};
    return { ...z, ship: zs[z.z] != null && zs[z.z] !== '' ? Number(zs[z.z]) : z.ship, cod: cs[z.z] != null ? !!cs[z.z] : z.cod };
  }
  root.APAR_DATA = { SHIP_DEFAULT, SHIP: SHIP_DEFAULT, quote, IM, TBC, CATS, PRODUCTS, STORY, STATUSES, COUPONS, zone, FAQ, POLICIES, POLICY_TEXT, SAMPLE_ORDERS, WA: '917851978274',
    CONTACT: { phone: '78519 78274', email: 'aparfragrances@gmail.com', address: '0-33, Amber Towar, Sansar chand Road, Jaipur' } };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.APAR_DATA;
})(typeof window !== 'undefined' ? window : globalThis);
