# Stripe Events Reference

Complete catalog of the 17 Stripe webhook events handled by this starter, with processing strategy and error policy.

---

## Idempotency strategy

Stripe guarantees **at-least-once delivery** — not exactly-once. Any event can be delivered multiple times (retries on non-2xx, manual replay from the Dashboard). The `webhook_events` table provides the idempotency guarantee:

```sql
CREATE UNIQUE INDEX webhook_events_stripe_event_id_idx
  ON webhook_events (stripe_event_id);
```

Before any event processing, the handler:

1. Queries `webhook_events WHERE stripe_event_id = $1`
2. If `status = 'succeeded'` → return 200, skip (duplicate delivery)
3. If `status = 'processing'` → return 200, skip (concurrent delivery)
4. If not found → `INSERT ... ON CONFLICT DO NOTHING`, then process

The `ON CONFLICT DO NOTHING` handles a race condition where two concurrent deliveries of the same event both pass the SELECT check and both attempt the INSERT simultaneously — only one will succeed, the other will be silently dropped.

---

## Error policy

| Stage | What happens on error | HTTP response |
|---|---|---|
| Before HMAC verify | Error thrown | 400 Bad Request |
| HMAC verify fails | 400 returned immediately | 400 Bad Request |
| After idempotency INSERT | Handler error caught | 200 OK, status=failed in DB |
| DB write in handler | Error caught, logged | 200 OK, status=failed in DB |

**Stripe retries on non-2xx.** Returning 5xx for a transient DB error causes exponential retries — but the DB write may have partially succeeded, so retrying can double-process. The correct strategy is: **return 200, mark failed, inspect the DB, replay once fixed.**

---

## Event catalog

### Subscription events

#### `customer.subscription.created`

Fired when a subscription is first created — usually immediately after checkout completes.

**Handler:** `handleSubscriptionCreated`
**Action:** Upserts a row in `subscriptions` with `status`, price ID, period dates, and trial end date.
**Key fields:** `subscription.status`, `subscription.items.data[0].price.id`, `subscription.trial_end`

---

#### `customer.subscription.updated`

Fired on any subscription change: plan upgrade/downgrade, status change (e.g., `trialing → active`), payment method update, cancellation scheduling.

**Handler:** `handleSubscriptionUpdated`
**Action:** Full upsert of the `subscriptions` row — overwrites all mutable fields.
**Key fields:** `subscription.status`, `subscription.cancel_at_period_end`, `subscription.canceled_at`

> This is the most frequently delivered subscription event. It covers `trialing → active` transitions (when trial ends + first payment succeeds), as well as mid-cycle plan changes triggered by `changePlan()`.

---

#### `customer.subscription.deleted`

Fired when a subscription is permanently canceled (not scheduled — actually ended).

**Handler:** `handleSubscriptionDeleted`
**Action:** Updates `subscriptions.status = 'canceled'`.

---

#### `customer.subscription.trial_will_end`

Fired 3 days before a trial ends (configurable in Stripe Dashboard).

**Handler:** `handleSubscriptionTrialWillEnd`
**Action:** Logs the event. **TODO:** Send a "trial ending soon" email via your email provider.

---

#### `customer.subscription.paused`

Fired when a subscription enters `paused` status (requires Stripe subscription pause feature enabled).

**Handler:** `handleSubscriptionPaused`
**Action:** Updates `subscriptions.status = 'paused'`.

---

#### `customer.subscription.resumed`

Fired when a paused subscription is resumed.

**Handler:** `handleSubscriptionResumed`
**Action:** Updates `subscriptions.status = 'active'`.

---

### Invoice events

#### `invoice.payment_succeeded`

Fired when an invoice is paid successfully — covers initial subscription payment, recurring renewals, and manual retries.

**Handler:** `handleInvoicePaymentSucceeded`
**Action:** Upserts the invoice row with `status = 'paid'`. On the initial payment, this confirms the subscription is live.

---

#### `invoice.payment_failed`

Fired when a payment attempt fails. Stripe will retry based on your dunning settings (Smart Retries or fixed schedule).

**Handler:** `handleInvoicePaymentFailed`
**Action:** Upserts the invoice row with `status = 'uncollectible'` or `'open'` depending on Stripe's determination. **TODO:** Send a payment failure notification email.

> After enough failed retries, Stripe fires `customer.subscription.updated` with `status = 'past_due'`, then eventually `customer.subscription.deleted` if the dunning period ends.

---

#### `invoice.finalized`

Fired when an invoice is finalized (locked for payment). Occurs before `invoice.payment_succeeded`.

**Handler:** `handleInvoiceFinalized`
**Action:** Upserts the invoice row with `status = 'open'`, hosted URL, and PDF URL.

---

#### `invoice.upcoming`

Fired several days before a recurring invoice is created (default: 3 days, configurable).

**Handler:** `handleInvoiceUpcoming`
**Action:** Logs the event. **TODO:** Send an "upcoming invoice" notification.

> Unlike other invoice events, `invoice.upcoming` does not have a real invoice ID — it is a preview notification. Do not attempt to save it to the `invoices` table.

---

### Checkout events

#### `checkout.session.completed`

Fired when a Stripe Checkout session completes successfully (payment authorized).

**Handler:** `handleCheckoutSessionCompleted`
**Action:**
1. Updates `customers.stripe_customer_id` from the session's `customer` field (in case it was created during checkout)
2. Logs the session metadata for debugging

> At this point the subscription exists in Stripe but `customer.subscription.created` has not necessarily been delivered yet. Do not rely on this event alone to provision access — wait for the subscription event.

---

#### `checkout.session.expired`

Fired when a Checkout session expires without payment (default: 24 hours).

**Handler:** `handleCheckoutSessionExpired`
**Action:** Logs the event. **TODO:** Track abandoned checkouts for conversion analysis.

---

### Customer events

#### `customer.created`

Fired when a Stripe customer is created.

**Handler:** `handleCustomerCreated`
**Action:** Logs. The `customers` table is populated by `createOrGetCustomer()` before checkout — this event is informational.

---

#### `customer.updated`

Fired when a customer's email, name, or metadata changes.

**Handler:** `handleCustomerUpdated`
**Action:** Updates `customers.stripe_customer_id` metadata if needed. **TODO:** Sync email changes to your users table.

---

#### `customer.deleted`

Fired when a Stripe customer is deleted (rare — usually only in test mode).

**Handler:** `handleCustomerDeleted`
**Action:** Logs. A production app should soft-delete or anonymize the `customers` row.

---

### Billing portal events

#### `billing_portal.configuration.created`

Fired when a new billing portal configuration is created in your Stripe account.

**Handler:** `handleBillingPortalConfigurationCreated`
**Action:** Logs. Informational.

---

#### `billing_portal.session.created`

Fired when a customer opens the billing portal.

**Handler:** `handleBillingPortalSessionCreated`
**Action:** Logs for analytics. **TODO:** Track portal opens to measure self-serve usage.

---

## Unhandled events

Events not in the `HandledStripeEventType` union are acknowledged with `200 OK` and skipped:

```typescript
if (!isHandledEventType(event.type)) {
  return NextResponse.json({ received: true, handled: false });
}
```

This is intentional — Stripe sends many event types (payment method events, dispute events, payout events, etc.) that are irrelevant to subscription billing. Unhandled events are not written to `webhook_events` and do not consume idempotency slots.

---

## Replaying failed events

To replay a `failed` event after fixing the underlying bug:

1. Find the `stripe_event_id` in the `webhook_events` table
2. Delete (or update to `pending`) the row to clear the idempotency block
3. In the Stripe Dashboard → Developers → Webhooks → your endpoint → "Resend" the event
4. Alternatively, use the Stripe CLI: `stripe events resend evt_1AbC...`
