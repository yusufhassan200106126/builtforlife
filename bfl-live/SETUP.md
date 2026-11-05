# Built For Life: going live

This folder is the full working website: the public site, the Future You questionnaire, checkout with Stripe, the coach panel and the client portal, plus the server code that runs them on Cloudflare.

```
site/                    the website (HTML, CSS, JS, images)
functions/api/[[route]].js  the server: logins, database, photos, live sync, Stripe, AI, emails
schema.sql               database tables (run once)
wrangler.toml            Cloudflare settings
dev/local-server.mjs     test the whole thing on your computer, no accounts needed
```

The site switches itself: hosted on Cloudflare with the database connected it runs **live**. Opened from a folder or any other host it falls back to the **demo** (saved in the browser only), so the demo you presented still works.

---

## 1. Test it on your computer first (5 minutes)

You need Node.js 22.5 or newer (`node -v`).

```bash
node --no-warnings dev/local-server.mjs
```

Open http://localhost:8788. Everything runs for real except the outside services, which are pretend:

| Service | Locally |
|---|---|
| Stripe | A fake payment page (just press Pay). It sends a real signed webhook back. |
| AI image | Returns the uploaded photo, so you can see the flow without paying for AI. |
| Emails | Not sent. Read them at http://localhost:8788/__mails |
| Login codes | Shown on screen (test mode) |

Coach panel: http://localhost:8788/admin.html, log in with `jory@builtforlife.uk`.

Try the full loop: questionnaire → checkout → pay → welcome → portal login → coach sends a workout and a message → client replies. Open the coach panel and portal side by side and watch it update live.

To start again from empty, stop the server and delete `dev/.local.sqlite` and `dev/.local-photos`.

---

## 2. Accounts you need

| Account | What for | Cost |
|---|---|---|
| **Cloudflare** | Hosting, database (D1), photo storage (R2) | Turn on **Workers Paid: $5/month**. The free plan works for testing, but the live chat and the coach panel need the bigger allowance once real clients use it. |
| **Stripe** (Jory's) | Card payments | 1.5% + 20p per UK card payment. No monthly fee. |
| **Resend** | Login codes and email alerts | Free up to 100 emails a day (3,000/month). Move to the $20/month plan before launch, as login codes alone can pass 100 a day with lots of clients. |
| **Open Food Facts** | Food search and barcodes | Free. Shows "Food data from Open Food Facts" as their licence asks. |
| **Google AI Studio** | The AI future-you photo (Gemini "Nano Banana") | About $0.03–0.04 per image. Set a budget cap. |

Set up Stripe, Resend and Google under **Jory's** business accounts, not yours, so the money and the data are his. You only need access.

---

## 3. Put it on Cloudflare

In this folder, in a terminal:

```bash
npm install
npx wrangler login
```

**Database**
```bash
npx wrangler d1 create bfl
```
Copy the `database_id` it prints into `wrangler.toml` (replace `PASTE-YOUR-D1-DATABASE-ID-HERE`). Then create the tables:
```bash
npm run db:init
```

**Photo storage.** In the Cloudflare dashboard open **R2** and enable it (it asks for a card; the first 10 GB are free). Then:
```bash
npx wrangler r2 bucket create bfl-photos
```

**Settings.** Edit `[vars]` in `wrangler.toml`:
- `COACH_EMAILS`: Jory's email (add more, separated by commas, for staff)
- `EMAIL_FROM`: the sender, e.g. `Built For Life <hello@builtforlife.uk>`
- `DEMO_CODES`: leave as `"1"` while testing (codes show on screen), set to `"0"` before launch
- `AI_DAILY_LIMIT`: the most AI images per day (cost cap)

**Deploy**
```bash
npx wrangler pages project create builtforlife
npm run deploy
```
It prints the address, something like `https://builtforlife.pages.dev`. Open `/admin.html` and log in with Jory's email to check it's live (the badge top right says **Live**).

**Secrets** (never put these in files). Run each and paste the value when asked:
```bash
npx wrangler pages secret put STRIPE_SECRET_KEY --project-name builtforlife
npx wrangler pages secret put STRIPE_WEBHOOK_SECRET --project-name builtforlife
npx wrangler pages secret put GEMINI_API_KEY --project-name builtforlife
npx wrangler pages secret put RESEND_API_KEY --project-name builtforlife
npx wrangler pages secret put CODE_SALT --project-name builtforlife
```
`CODE_SALT` is any long random text. Run `npm run deploy` again afterwards so the new secrets are picked up.

Anything not set yet simply stays off: no Stripe key means checkout says payments aren't on yet; no Gemini key means the simple preview is used; no Resend key means no emails.

---

## 4. Connect the services

### Stripe (start in **test mode**)
1. Stripe dashboard → switch on **Test mode** → Developers → API keys → copy the **Secret key** (`sk_test_…`) into `STRIPE_SECRET_KEY`.
2. Developers → Webhooks → **Add endpoint**:
   - URL: `https://YOUR-SITE/api/stripe-webhook`
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, `invoice.paid`, `invoice.payment_failed` (the last two are for monthly payment plans)
3. Copy the endpoint's **Signing secret** (`whsec_…`) into `STRIPE_WEBHOOK_SECRET`. Deploy again.
4. Test card: `4242 4242 4242 4242`, any future date, any CVC.

Prices are set on the server (`functions/api/[[route]].js`, top of the file), so nobody can change them in their browser. If Jory changes a price, change it there **and** in `site/js/store.js` (that copy is only for display).

Refunds: do them in Stripe. The order in the coach panel changes to "refunded" by itself.

### Resend (emails)
1. Add the domain `builtforlife.uk` and add the DNS records it gives you where the domain is managed.
2. Once it says **Verified**, create an API key → `RESEND_API_KEY`.
3. `EMAIL_FROM` must use that domain.

Emails sent: login codes; to the client, a welcome with their portal link after paying; to Jory, new sign-ups, payments, and client messages (at most one email per client every 30 minutes, so he isn't spammed).

### Google Gemini (AI future-you photo)
1. https://aistudio.google.com → **Get API key** → create one in a project with billing on → `GEMINI_API_KEY`.
2. In Google Cloud → Billing → **Budgets & alerts**, set a monthly budget (e.g. £20) with alerts.
3. Each person can make at most 3 images a day, and `AI_DAILY_LIMIT` caps the total.
4. If Google renames the model, set `GEMINI_MODEL` in `[vars]` (default `gemini-nano-banana-2.1`).

Only the photo and a fixed instruction built from their numbers are sent to Google, never names or contact details.

---

## 5. Use Jory's own domain

Cloudflare dashboard → Workers & Pages → builtforlife → **Custom domains** → add `builtforlife.uk` (and `www`). Cloudflare shows the DNS change to make. The current site's shop links point at Squarespace, so agree the switch-over time with Jory; once the domain moves, the new site replaces the old one.

After moving, set `SITE_URL = "https://builtforlife.uk"` in `[vars]` and update the Stripe webhook URL.

---

## Client risk alerts and notifications

**At risk** in the coach panel flags any client who:
- hasn't trained for 7+ days (while workouts are planned)
- has missed 2+ weekly check-ins
- hasn't logged food or workouts for 5+ days
- hasn't replied to Jory for 3+ days

New clients get a 3-day grace period. Each card shows why, when they last trained, checked in, logged and opened the app, with a ready-made nudge (editable) to send to their portal or WhatsApp. "I've handled it" snoozes the alert for 3 days to 2 weeks. The rules are in `site/js/risk.js` if Jory wants to change the numbers.

**Notifications**
- **Bell** (top right of the coach panel): sign-ups, payments, check-ins, messages, finished workouts and at-risk clients.
- **Pop-ups**: turn on in Settings → Notifications, per device. They work while the coach panel is open (on iPhone, add it to the Home Screen first). Clients can turn on pop-ups for Jory's replies in their chat.
- **Morning email** to Jory at 8am UK time: who's at risk, plus yesterday's sign-ups, money, check-ins and unread messages. It runs on the first visit to the site after 8am, so there's nothing extra to set up.
- **Emails to clients**: when Jory messages them and they're not in the app (at most every 30 minutes), and a check-in reminder when they're a day overdue (once a week).

Each email can be switched off in Settings → Notifications. All emails use the branded designs in `lib/emails.js`.

If you set the site up before this update, run `npm run db:init` again: it only adds the new table and keeps everything else.

---

## Everything else that's built in

None of these need extra setup beyond the steps above.

**Staff coaches.** Settings → Team → add a coach's name and email. They log in at the coach panel with their own email and only see the clients you give them (open a client → Coach). They never see payments, the pipeline, other coaches' clients or settings. Removing a coach logs them out and hands their clients back to you. Client messages email and notify the client's own coach.

**Monthly payments.** Plans from £500 can be paid in 3 monthly payments, from £1,500 in 3 or 6, and from £3,500 in 3, 6 or 12, at no extra cost. Stripe takes each payment automatically and stops after the last one. Failed payments show in Payments, the client gets an email and a banner in their portal with a link to pay, and you're alerted. The amounts are rounded down to the penny, so a split plan can come to a few pence less than the full price. Change the rules in `payOptions` (in both `functions/api/[[route]].js` and `site/js/store.js`).

**Health questionnaire and waiver.** New clients answer 8 health questions (PAR-Q style), add an emergency contact and sign the agreement in their portal before training. Any "yes" is flagged in the bell and on their profile until you mark them "Cleared to train". Paper forms can be noted instead. Have Jory's insurer check the wording in `site/js/store.js` (HEALTH_Q and WAIVER).

**The app.** The portal and coach panel install like apps: "Install" on Android and computers, Share → Add to Home Screen on iPhone. Once installed, push notifications work even when the app is closed (messages, bookings, payments, sign-ups, check-in reminders). The push keys are made automatically. The portal also opens with no signal and sends anything logged offline when it's back online.

**Videos.** Upload exercise demo videos in Training → Library, or paste a YouTube link. Clients tap play inside the workout. They can send form-check videos from any exercise, and you can reply with a video. Up to 80MB each (about a minute of phone video). Videos are stored in R2 like photos.

**Food search and barcodes.** Clients search a built-in list of everyday foods plus the free Open Food Facts database, or scan a barcode, then pick grams or servings. Calories, protein, carbs and fat add up automatically. You see their last 7 days on their profile. Barcode scanning uses the camera on Android and Chrome; on iPhone it loads a free scanner the first time, and typing the barcode number always works.

**Habits.** Every client gets daily habits on their Today screen (steps, sleep and veg by default). Change them per client on their profile. Ticking habits counts as being active for the risk alerts.

**Self-booking.** Diary → Booking hours: set the days and times clients can book, session length, notice and whether you confirm each booking. Clients book and cancel in their portal (cancelling is blocked inside the notice period). Requests appear in Diary → To sort. "Get my calendar link" gives a private link that puts your diary in Google Calendar or your iPhone calendar. It's one way: changes made in Google don't come back.

**Challenges and community.** Community → start a challenge (workouts, check-ins, habits, steps or food days, with dates and a prize). Clients see a live leaderboard and a members' wall in their Team tab, with first name and initial only. They can hide themselves. You can post to everyone, post the leaderboard, and delete any post.

If you set the site up before these were added, run `npm run db:init` again: it only adds the new tables.

---

## 6. Testing checklist (in Stripe test mode)

- [ ] Questionnaire with a photo: the result shows the AI image, and the sign-up appears in the coach panel within a few seconds
- [ ] Questionnaire without a photo still works
- [ ] Checkout from the result: details prefilled; pay with 4242…; welcome screen; order in **Payments**; client and Jory get emails
- [ ] Buying directly from a programme page (no questionnaire) works
- [ ] Cancelling on Stripe returns to checkout with "Payment cancelled"
- [ ] Client logs in to the portal with the emailed code
- [ ] Jory adds workouts (Training → apply a template) and they appear in the portal
- [ ] Client ticks off sets and finishes a workout; Jory sees it
- [ ] Chat both ways on phone and laptop, with photos and the typing dots
- [ ] Weekly check-in with a photo reaches Jory's **Check-ins**
- [ ] Deleting a test sign-up removes their workouts, messages and photos (paid orders stay for the accounts)
- [ ] Coach panel and portal work on a phone
- [ ] A client who goes quiet shows in **At risk**; sending a nudge reaches their portal and their email
- [ ] Add a staff coach, give them a client, log in as them: they only see that client and no payments
- [ ] Buy a plan with 3 monthly payments (test card), then in the Stripe dashboard use the test clock or wait to see payment 2 arrive
- [ ] A new client fills in the health form; a "yes" answer shows on their profile
- [ ] Install the portal on a phone, turn on notifications, and get a push when the coach messages
- [ ] Upload an exercise video; it plays in the client's workout. Send a form-check video from the client side
- [ ] Search a food, scan a barcode (or type it), and see the totals add up
- [ ] Turn on booking hours; a client books, you confirm, it shows in your Google calendar link
- [ ] Start a challenge; two test clients see the leaderboard and can post and like
- [ ] The morning email arrives after 8am (or log in as coach and run `fetch('/api/daily-now',{method:'POST'})` in the browser console to send it now)

## 7. Launch day

1. Stripe: switch to **live mode**, copy the live secret key, create the same webhook in live mode, and put the new `sk_live_…` and `whsec_…` in the secrets.
2. Set `DEMO_CODES = "0"` in `wrangler.toml`.
3. Fill in the gaps in `site/privacy.html` (business name and address, date) and have Jory check it.
4. Clear the test data:
   ```bash
   npx wrangler d1 execute bfl --remote --command "DELETE FROM records WHERE coll NOT IN ('library','templates'); DELETE FROM pending; DELETE FROM sessions; DELETE FROM lead_tokens; DELETE FROM typing; DELETE FROM counters WHERE k = 'order';"
   ```
   (Test photos can be emptied in the dashboard: R2 → bfl-photos.)
5. `npm run deploy`
6. Do one real payment on the cheapest plan with your own card, then refund it in Stripe.

---

## Good to know

- **Backups.** D1 keeps 30 days of history. To roll back: `npx wrangler d1 time-travel restore bfl --timestamp=…`. Export a copy any time: `npx wrangler d1 export bfl --remote --output=backup.sql`.
- **Logs.** Cloudflare dashboard → builtforlife → Functions → Real-time logs. Stripe, AI and email errors show there.
- **Who sees what.** Clients only ever receive their own records. Jory's private notes on a client are never sent to the client. Photos are only served to the client they belong to and to the coach.
- **Speed at scale.** The coach panel loads all clients plus the last 120 days of workouts and food logs; older history stays in the database.
- **Order numbers** count up (BFL-1001, 1002…). A number is used when someone starts checkout, so an abandoned checkout leaves a gap. Stripe is the record of actual payments.
- **Testing with the real services on your computer:** copy `.dev.vars.example` to `.dev.vars`, fill in test keys, then `npx wrangler pages dev` (Stripe webhooks need the Stripe CLI: `stripe listen --forward-to localhost:8788/api/stripe-webhook`).
