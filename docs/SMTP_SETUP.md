# Email (SMTP) — Setup Guide

The app sends email through **plain SMTP** — no third-party API, no vendor account. Works with Gmail, Google Workspace, your web host's mail server, Zoho, Fastmail, or an internal relay.

Sending happens in the Supabase Edge Function `dispatch-notifications`, so the credentials live in **Supabase secrets**, never in the web app.

---

## The one setting people get wrong

`SMTP_PORT` and `SMTP_SECURE` must agree:

| Port | `SMTP_SECURE` | Why |
|---|---|---|
| **465** | `true` | Implicit TLS — the connection is encrypted from the first byte. |
| **587** | `false` | Plaintext connect, then upgraded via STARTTLS. |

Setting `secure: true` on port 587 (or `false` on 465) produces a connection that **hangs and then times out** with no useful error. If sending is silently timing out, check this first.

**Use 465 where you can.** Some hosts throttle or block 587.

---

## Gmail / Google Workspace

Gmail requires an **App Password** — your normal account password will not work, and OAuth is overkill here.

1. **Enable 2-Step Verification.** [myaccount.google.com](https://myaccount.google.com) → **Security** → **2-Step Verification**. App Passwords do not exist without it.
2. Go to **Security** → search settings for **App passwords** (or [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)).
3. Create one named `Aurum Ops`. Copy the **16-character** password — Google shows it once.
4. Set the secrets:

```bash
npx supabase secrets set \
  SMTP_HOST=smtp.gmail.com \
  SMTP_PORT=465 \
  SMTP_SECURE=true \
  SMTP_USER=you@yourdomain.com \
  SMTP_PASSWORD=abcdefghijklmnop \
  SMTP_FROM="Aurum Ops <you@yourdomain.com>"
```

Paste the App Password **without spaces**. Google displays it as `abcd efgh ijkl mnop`; the spaces are for readability only.

### Gmail limits

| | Recipients/day | Recipients per message |
|---|---|---|
| Free Gmail | 500 | 100 |
| Google Workspace | 2,000 | 100 |

Exceeding them gets outgoing mail blocked for up to 24 hours. This app sends a handful of alerts a day, so you are nowhere near — but it's a hard ceiling if you ever move to customer-facing mail.

`SMTP_FROM` must be the same account as `SMTP_USER` (or a verified alias). Gmail rewrites mismatched From headers, which hurts deliverability.

---

## Other providers

Same variables, different values:

**Zoho**
```
SMTP_HOST=smtp.zoho.in     SMTP_PORT=465   SMTP_SECURE=true
```

**Microsoft 365** (no 465 support — must use 587)
```
SMTP_HOST=smtp.office365.com   SMTP_PORT=587   SMTP_SECURE=false
```

**Typical cPanel / shared host**
```
SMTP_HOST=mail.yourdomain.com   SMTP_PORT=465   SMTP_SECURE=true
```

---

## Who receives the alerts

Two sources, combined:

1. **Every approved Accountant** — automatic, from `app_users`. They're the verification desk, so they always get a copy, and it self-heals as staff change.
2. **Anyone in `notification_recipients`:**

```sql
insert into public.notification_recipients (label, channel, destination, events)
values ('Ops inbox', 'EMAIL', 'ops@yourdomain.com',
        '{BOOKING_SUBMITTED,PAYMENT_ADDED}');
```

There's also an env fallback (`OPS_ALERT_EMAILS` in `.env.local`) used only while that table is empty — for bootstrapping.

---

## Verify it works

**1. Dry run first.** With `INTEGRATIONS_DRY_RUN=true`, nothing is sent and rows are recorded as `SKIPPED` — never `SENT` — so a dry run is always distinguishable from a real delivery.

```bash
npx supabase secrets set INTEGRATIONS_DRY_RUN=true
```
Create a booking, then:
```sql
select channel, status, provider, recipient, error_code, error_message
from public.notification_deliveries order by created_at desc limit 10;
```
Expect `SKIPPED` / `noop`. **If you get no rows at all, the problem is enqueue, not email** — check the web app's server logs.

**2. Go live.**
```bash
npx supabase secrets set INTEGRATIONS_DRY_RUN=false
```
Create another booking. Expect `SENT` / `smtp`.

**3. Watch the logs.**
```bash
npx supabase functions logs dispatch-notifications
```

---

## Errors you'll actually hit

Recorded in `notification_deliveries.error_code`. The worker stops retrying terminal errors and backs off transient ones (1m → 5m → 30m).

| Code | Meaning | Fix |
|---|---|---|
| `SMTP_AUTH` | Rejected credentials | Wrong App Password, or 2-Step Verification was turned off (which silently invalidates every App Password). Regenerate. |
| `ETIMEDOUT` / `ESOCKET` | Connection never established | Almost always the port/secure mismatch above. |
| `EDNS` / `ENOTFOUND` | Hostname doesn't resolve | Typo in `SMTP_HOST`. |
| `550` / `553` | Recipient rejected | Bad address, or the From domain isn't allowed to send. |
| `454` / `421` | Throttled | Transient — retries handle it. Persistent means you hit the daily cap. |

---

## Deliverability

Mail from a plain Gmail account to internal colleagues is fine. If it starts landing in spam, or you later send to people outside the company, publish DNS records for your sending domain:

- **SPF** — authorises the sending server
- **DKIM** — signs the message
- **DMARC** — tells receivers what to do on failure

Google Workspace generates DKIM for you in Admin Console → Apps → Gmail → Authenticate email. A plain `@gmail.com` account can't be DKIM-signed for your own domain — that's the point at which a dedicated transactional provider starts to earn its keep.
