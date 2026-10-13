# APAR website

Live store for APAR (Jaipur). Same design as "APAR Shop v2", now with real accounts, orders and payments.

## How it fits together
- `public/` – the website (hosted by Netlify). Product list, prices and pack sizes: `public/assets/js/apar-data.js`.
- `netlify/functions/` – secure server code: creates orders, checks prices/stock, talks to Razorpay.
- Firebase (project `apar-471bf`) – customer login + database (orders, customers, stock, coupons, reviews, B2B leads).
- Razorpay – online payments (UPI, cards, net banking, wallets). Cash on Delivery works without Razorpay.

## Netlify environment variables (Project configuration → Environment variables)
| Name | What to paste |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Whole JSON file from Firebase → Project settings → Service accounts → Generate new private key |
| `RAZORPAY_KEY_ID` | Razorpay → Settings → API Keys → Key ID (`rzp_test_…` first, later `rzp_live_…`) |
| `RAZORPAY_KEY_SECRET` | Key Secret from the same screen |
| `RAZORPAY_WEBHOOK_SECRET` | (optional, recommended) secret you type when adding the webhook below |

Razorpay webhook (optional backup): Settings → Webhooks → Add → URL `https://<your-site>/.netlify/functions/razorpay-webhook`, event `order.paid`.

## Admin
Admin panel can: add/edit/hide products, upload photos, change pack sizes, prices, stock and product details; update order status, payment status, courier and tracking number; see customers, payments, reviews, B2B leads; edit announcement bar, FSSAI and GSTIN (Site settings). Product photos are stored in Netlify Blobs and served at `/media/...`.

Open `/#/admin` and sign in (Google or email link) with **aparfragrances@gmail.com**.
To add another admin email, change it in `firestore.rules`, `public/assets/js/apar-cloud.js` (`ADMIN_EMAILS`) and set Netlify variable `ADMIN_EMAILS`.

## Firestore rules
Copy `firestore.rules` into Firebase → Firestore Database → Rules → Publish whenever it changes.
