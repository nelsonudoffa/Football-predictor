# Paid access Worker setup (free addresses)

The website changes are in `index.html`. The Worker source is `worker/worker.js` and database schema is `worker/schema.sql`. These files being in GitHub does **not** deploy them to the existing Cloudflare Worker automatically.

## 1. Back up the current Worker
Cloudflare Dashboard → Workers & Pages → `football-predictor-api` → Edit code. Copy the current code into a safe backup before replacing it.

## 2. Create/bind a D1 database
Cloudflare Dashboard → Storage & databases → D1 SQL database → Create database (for example `football-predictor-access`).
Open the database's SQL console and run all SQL from `worker/schema.sql`.
Then open the Worker → Settings → Bindings → Add binding → D1 database:
- Variable name: `DB`
- Database: the database you created
Save.

## 3. Configure Worker secrets
Worker → Settings → Variables and Secrets. Add these as **secrets**, not plain text variables:
- `FOOTBALL_DATA_API_KEY`: your existing football-data.org API token (preserve the existing value)
- `ADMIN_TOKEN`: generate a long random secret, at least 32 characters. Keep it private.
Do not put `ADMIN_TOKEN` in GitHub or share it with students. The admin page asks for this token when you review payments.

## 4. Deploy the Worker code
Open `worker/worker.js` in GitHub and copy its complete contents into the Cloudflare Worker editor, replacing the current Worker source only after backing it up. Save and deploy. This code retains the football-data.org proxy and adds the payment endpoints. Confirm `/health` still returns JSON with `ok: true`.

## 5. Test the workflow
1. Open https://nelsonudoffa.github.io/Football-predictor/ and refresh.
2. The access panel should show a count after the Worker and D1 are configured.
3. Test a payment request using a test/reference value only; it must appear as pending.
4. On the admin panel, enter the `ADMIN_TOKEN`, load pending requests, and approve only after checking the actual incoming funds in OPay/bank.
5. Confirm the same browser shows Approved. Access lasts 30 days per approved request.

## Important limitations and safety
- WhatsApp is opened with a prefilled message after a request is saved. The user still presses Send; this is not automatic WhatsApp Business API delivery.
- Approval is tied to a browser/device ID stored in localStorage, not a verified login account. Clearing browser data or changing device can reset the free counter, and approval will not automatically follow the user to another device. This is a starter device-based gate, not strong anti-abuse account security. To securely enforce subscriptions across devices, add authenticated student accounts (for example Supabase Auth) and bind payments to the authenticated user ID.
- The Worker needs a D1 binding and `ADMIN_TOKEN` before payment endpoints work. Until configured and tested, paid access is not active.
- Do not approve based only on a screenshot or the student's claim. Check your OPay/bank balance and transaction record first.
