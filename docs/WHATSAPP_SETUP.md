# WhatsApp Cloud API — Setup Guide

Everything you need to do in Meta's console to make WhatsApp alerts work. The code is already written; this is purely the account/credential side.

**Budget 1–3 business days** — template approval is a human review at Meta and is the long pole. Start Step 6 first, then come back and do the rest while you wait.

---

## What you're collecting

By the end you'll have three values to hand to Supabase:

| Value | Looks like | Where it comes from |
|---|---|---|
| `WHATSAPP_PHONE_NUMBER_ID` | `123456789012345` | Step 3 |
| `WHATSAPP_ACCESS_TOKEN` | `EAAG...` (long) | Step 5 |
| `WHATSAPP_API_VERSION` | `v23.0` | fixed |

> **The Phone Number ID is not your phone number.** It's a numeric ID Meta assigns. Pasting the actual phone number here is the single most common setup mistake.

---

## Step 1 — Create the Meta app

1. Go to [developers.facebook.com](https://developers.facebook.com) and log in with a Facebook account. (This account becomes an admin of the app — use a company account, not a personal one you might lose access to.)
2. **My Apps** → **Create App**.
3. Choose the use case **"Connect with customers through WhatsApp"** — not "Other". Picking the wrong use case means the WhatsApp product isn't attached and Step 2 won't appear.
4. Give it a name (e.g. `Aurum Ops`) and create.

## Step 2 — Attach a WhatsApp Business Account

1. In the left sidebar: **WhatsApp** → **API Setup**.
2. Either select an existing WhatsApp Business Account (WABA) or let Meta create one.
3. Note the **WhatsApp Business Account ID** shown on this page. You don't need it in the app config, but you'll need it in Step 5 and for support tickets with Meta.

## Step 3 — Get the Phone Number ID

Still on **API Setup**:

- Meta gives you a free **test number** to start with. Its **Phone Number ID** is displayed right there.
- Copy it. That's `WHATSAPP_PHONE_NUMBER_ID`.

The test number can only message numbers you explicitly add as recipients (Step 4), and it can't be used with customers. It is fine for verifying the whole pipeline works.

## Step 4 — Add a test recipient

1. On **API Setup**, in the **To** field, click **Manage phone number list**.
2. Add your own WhatsApp number, in full international format (`+91XXXXXXXXXX`).
3. You'll get a confirmation code on WhatsApp — enter it.
4. Click **Send message** on that page. If it arrives, the pipe works.

Do this before touching any code. If the sample message doesn't arrive, nothing downstream will either.

## Step 5 — Get a permanent access token

> **This is the step people get wrong.** The **"Generate access token"** button on the API Setup page gives you a token that **expires in 24 hours**. It's fine for the Step 4 test. If you ship it, WhatsApp alerts will work all afternoon and be mysteriously broken tomorrow morning.

For a token that doesn't expire:

1. Go to [business.facebook.com/settings](https://business.facebook.com/settings) (Business Settings).
2. **Users** → **System Users** → **Add**.
   - Name: `aurum-ops-worker`
   - Role: **Admin**
3. Select the new system user → **Assign Assets**.
   - Asset type: **Apps** → pick your app → enable **Full control**.
   - Assign again: **WhatsApp Accounts** → pick your WABA → enable **Full control**.
   - Both assignments are required. Missing the WABA one produces a token that authenticates but returns a permissions error on send.
4. Click **Generate new token**.
   - App: your app
   - Token expiration: **Never**
   - Permissions — tick exactly these three:
     - `whatsapp_business_messaging`
     - `whatsapp_business_management`
     - `business_management`
5. **Copy the token now.** Meta shows it once and never again.

That's `WHATSAPP_ACCESS_TOKEN`.

## Step 6 — Create the message templates

**Start this first if you can — approval takes 1–3 business days.**

Business-initiated messages (which ours are — nobody messaged us first) can only be sent using a **pre-approved template**. Free-form text is rejected outright with error `131047`.

Go to [business.facebook.com/wa/manage/message-templates](https://business.facebook.com/wa/manage/message-templates) → **Create template**.

### Template 1

- **Name:** `aurum_new_booking_alert`
- **Category:** **Utility** ← not Marketing. Utility is correct for transactional operational alerts, is billed at a lower rate, and is far less likely to be rejected.
- **Language:** English
- **Body:**

```
Aurum Ops: new booking {{1}} submitted by {{2}}.
Customer: {{3}}
Unit: {{4}}
Value: {{5}}
Awaiting accountant verification.
```

- **Sample values** (Meta requires these to review it):
  `RM2501042`, `Ravi Kumar`, `Anita Sharma`, `Aurum Heights / A-1204`, `Rs 1,25,00,000`

### Template 2

- **Name:** `aurum_new_payment_alert`
- **Category:** **Utility**
- **Language:** English
- **Body:**

```
Aurum Ops: new payment on booking {{1}}.
Amount: {{2}}
Mode: {{3}}
Added by: {{4}}
Remaining balance: {{5}}
Awaiting verification.
```

- **Sample values:** `RM2501042`, `Rs 5,00,000`, `Bank Transfer`, `Ravi Kumar`, `Rs 20,00,000`

### Rules that get templates rejected

- A template body **cannot start or end with a variable**. Both of ours start with "Aurum Ops:" — keep it that way.
- Variables must be numbered sequentially from `{{1}}` with no gaps.
- **The number and order of variables must match the code exactly.** Ours are built in `lib/integrations/templates.ts` → `bookingWhatsAppParams()` and `paymentWhatsAppParams()`. Change the template body without changing that function and you get error `132000` (parameter count mismatch).
- Don't use the ₹ glyph in template variables — the code sends `Rs` instead, deliberately, because the rupee symbol is a recurring source of encoding problems in review and on some Android clients.

## Step 7 — Give the credentials to Supabase

These are **Edge Function secrets**, not `.env.local`. The web app never holds them.

```bash
npx supabase secrets set \
  WHATSAPP_PHONE_NUMBER_ID=123456789012345 \
  WHATSAPP_ACCESS_TOKEN=EAAG... \
  WHATSAPP_API_VERSION=v23.0 \
  WHATSAPP_TEMPLATE_LOCALE=en
```

The template *names* live in the web app's `.env.local`, because they're written into the delivery row at enqueue time:

```
WHATSAPP_TEMPLATE_BOOKING=aurum_new_booking_alert
WHATSAPP_TEMPLATE_PAYMENT=aurum_new_payment_alert
```

## Step 8 — Say who receives the alerts

WhatsApp recipients are **never** auto-derived from your user list — WhatsApp is billed per conversation, and messaging someone's personal mobile without their opt-in is a consent problem. So they're explicit:

```sql
insert into public.notification_recipients (label, channel, destination, events)
values ('Accounts desk', 'WHATSAPP', '+919876543210',
        '{BOOKING_SUBMITTED,PAYMENT_ADDED}');
```

While using the Meta test number, only numbers added in Step 4 will receive anything.

## Step 9 — Go live

1. Set `INTEGRATIONS_DRY_RUN=false`:
   ```bash
   npx supabase secrets set INTEGRATIONS_DRY_RUN=false
   ```
2. Create a test booking in the app.
3. Check it went out:
   ```sql
   select channel, status, provider, error_code, error_message, created_at
   from public.notification_deliveries
   order by created_at desc limit 10;
   ```

`SENT` with a `provider_message_id` starting `wamid.` means Meta accepted it.

---

## Moving to your real number

The test number is throwaway. For production:

1. **WhatsApp** → **API Setup** → **Add phone number**.
2. The number must **not** currently be registered to a normal WhatsApp or WhatsApp Business app account. If it is, delete that account first and wait a few minutes — otherwise verification fails with no useful message.
3. Verify by SMS or voice call.
4. Set a display name. Meta reviews it; names that look like a generic category ("Real Estate") are often rejected — use your actual business name.
5. **Copy the new Phone Number ID** and update the Supabase secret. Each number has its own ID.
6. Complete **Business Verification** in Business Settings to lift the messaging limits (the unverified tier caps you at a small number of unique recipients per day).

---

## Error codes you'll actually hit

The worker classifies these automatically — terminal errors stop retrying, transient ones back off (1m → 5m → 30m). They land in `notification_deliveries.error_code`.

| Code | Meaning | Fix |
|---|---|---|
| `131047` | Outside the 24-hour window | Template not approved or paused. Check template status. |
| `132001` | Template not found | Name or language mismatch. Name must match `WHATSAPP_TEMPLATE_*` exactly, and the language must match `WHATSAPP_TEMPLATE_LOCALE`. |
| `132000` | Parameter count mismatch | Template body has a different number of `{{n}}` than the code sends. |
| `131026` | Not a valid WhatsApp user | The recipient number has no WhatsApp account. |
| `131008` | Missing required parameter | A template variable was sent empty. |
| `100` | Malformed request | Usually a wrong Phone Number ID, or the phone number was pasted instead of the ID. |
| `130429` | Rate limited | Transient — retries handle it. |
| `133016` | Account locked/in recovery | Check Business Manager for a restriction notice. |
| `401` / `190` | Bad or expired token | You shipped the 24-hour token. Redo Step 5. |

Function logs:
```bash
npx supabase functions logs dispatch-notifications
```

---

## Costs

Meta bills per 24-hour **conversation**, not per message, and the rate depends on category and country. Utility conversations in India are a fraction of a rupee each. There's a monthly allowance of free service conversations. Current rates: [Meta's pricing page](https://developers.facebook.com/docs/whatsapp/pricing).

At this app's volume — one conversation per booking or payment, to a handful of internal staff — this is negligible. It stops being negligible if you ever start messaging customers directly, which is a separate decision requiring recorded opt-in consent.
