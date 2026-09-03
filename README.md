# Aurum Operations Platform

## Purpose

Aurum is the internal operations workspace for managing real-estate bookings,
customer records, payment proofs, verification decisions, notifications, and
audit history. It is intended for approved employees only and is not a public
customer portal.

## Product Areas

- Dashboard: role-aware operational metrics and recent activity
- Bookings: customer, property, bank, financial, referral, and document data
- Payments: payment submission, proof attachment, review, and balance tracking
- Verification: accountant, administrator, and director review queues
- Inbox: user-specific approval, rejection, payment, and booking notifications
- Support: internal tickets and comments
- Audit: traceable administrative and financial actions
- Profile and settings: employee identity and notification preferences

## Roles

| Role | Responsibility |
| --- | --- |
| Sales Manager | Create and monitor owned bookings and payments |
| Channel Partner | Create and monitor owned bookings and payments |
| Accountant | Verify bookings and payments |
| Administrator | Operate verification, users, and support workflows |
| Director | Approve employees and oversee the organization |

Access is enforced in server-side route handlers and database policies. UI
visibility is not a security boundary.

## Architecture

- Next.js App Router provides server-rendered pages and route handlers.
- React and TypeScript provide the user interface and type safety.
- Supabase Auth provides employee sessions.
- Supabase Postgres stores business records and audit history.
- Supabase Storage stores booking and payment documents.
- Realtime notifications update the employee inbox and header indicators.
- Server-side service access is isolated from browser client code.

## Data Rules

Booking and customer forms validate identity, contact, bank, payment, date,
numeric, and loan information before submission. The API repeats validation so
client-side checks cannot be bypassed. Payment totals are not credited until
the configured reviewer approves the payment.

Documents may contain sensitive customer and financial information. Treat them
as confidential records and share them only with authorized team members.

## Database State

The database migrations in `supabase/migrations` are the source of truth. The
repair migrations `0015` through `0018` restore customer profile fields,
booking detail fields, and the booking/customer junction table for databases
that were partially initialized. PostgREST schema state must be refreshed
after manual database changes.

## Security Requirements

- Keep all service-role credentials server-only and rotate credentials that may
  have been exposed.
- Do not commit environment files, tokens, private keys, or customer documents.
- Keep production callback and application URLs separate from local settings.
- Require approved employee status and role authorization on every mutation.
- Review and test RLS policies whenever a table or relationship changes.
- Restrict Storage access by authenticated user, path ownership, MIME type, and
  file size at the bucket policy level.
- Add rate limiting for authentication, registration, booking, payment, review,
  and upload endpoints before production launch.
- Use MFA for administrators and directors where supported by the identity
  provider.
- Never log PAN, Aadhaar, bank account numbers, payment files, tokens, or full
  request bodies.
- Keep audit records append-oriented and restrict audit visibility to approved
  administrative roles.
- Define retention, deletion, backup, and incident-response procedures for
  identity data and uploaded documents.
- Validate signatures for all inbound integration webhooks.

The application sends browser security headers including clickjacking,
MIME-sniffing, referrer, permissions, cross-origin, and production transport
protections. These headers complement, but do not replace, authentication,
authorization, RLS, Storage policies, and operational controls.

## Performance Characteristics

- Dashboard aggregates and independent page queries run in parallel where safe.
- Operational lists use bounded queries, pagination, and scroll containers.
- Mobile pages use responsive cards and reserve space for bottom navigation.
- Booking side effects are parallelized after the required records are created.
- File selection validates type and size before upload and avoids an unnecessary
  authentication round trip.
- Production bundles remove non-essential console output and optimize common
  icon/chart imports.

Performance should be monitored using API latency, database query duration,
Storage upload time, client errors, notification delivery, and Core Web Vitals.
Large documents should be compressed or uploaded with resumable transfer when
mobile networks or document sizes justify it.

## Operational Ownership

The internal operations owner is responsible for employee access, role review,
data retention, and incident escalation. The engineering owner is responsible
for migrations, deployments, backups, monitoring, and dependency updates.

Every release should be checked across all roles, booking creation, payment
submission, document upload, approval and rejection, realtime notifications,
audit visibility, and mobile layouts.
