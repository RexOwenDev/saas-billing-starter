// ============================================================
// types/stripe.ts
// Discriminated unions for all Stripe event types handled by
// the webhook router. TypeScript will enforce exhaustive matching.
// ============================================================

import type Stripe from "stripe";

// ============================================================
// Event discriminated union
// Add new event types here AND to the handler switch statement.
// ============================================================

export type HandledStripeEventType =
  // Subscription lifecycle
  | "customer.subscription.created"
  | "customer.subscription.updated"
  | "customer.subscription.deleted"
  | "customer.subscription.trial_will_end"
  | "customer.subscription.paused"
  | "customer.subscription.resumed"
  // Invoice lifecycle
  | "invoice.payment_succeeded"
  | "invoice.payment_failed"
  | "invoice.upcoming"
  | "invoice.finalized"
  // Checkout
  | "checkout.session.completed"
  | "checkout.session.expired"
  // Customer
  | "customer.created"
  | "customer.updated"
  | "customer.deleted"
  // Billing portal
  | "billing_portal.configuration.created"
  | "billing_portal.session.created";

// ============================================================
// Typed event variants (one per event category)
// ============================================================

export interface StripeSubscriptionEvent {
  type: Extract<
    HandledStripeEventType,
    | "customer.subscription.created"
    | "customer.subscription.updated"
    | "customer.subscription.deleted"
    | "customer.subscription.trial_will_end"
    | "customer.subscription.paused"
    | "customer.subscription.resumed"
  >;
  data: { object: Stripe.Subscription };
  id: string;
  livemode: boolean;
  created: number;
}

export interface StripeInvoiceEvent {
  type: Extract<
    HandledStripeEventType,
    | "invoice.payment_succeeded"
    | "invoice.payment_failed"
    | "invoice.upcoming"
    | "invoice.finalized"
  >;
  data: { object: Stripe.Invoice };
  id: string;
  livemode: boolean;
  created: number;
}

export interface StripeCheckoutEvent {
  type: Extract<
    HandledStripeEventType,
    "checkout.session.completed" | "checkout.session.expired"
  >;
  data: { object: Stripe.Checkout.Session };
  id: string;
  livemode: boolean;
  created: number;
}

export interface StripeCustomerEvent {
  type: Extract<
    HandledStripeEventType,
    "customer.created" | "customer.updated" | "customer.deleted"
  >;
  data: { object: Stripe.Customer };
  id: string;
  livemode: boolean;
  created: number;
}

export interface StripeBillingPortalEvent {
  type: Extract<
    HandledStripeEventType,
    | "billing_portal.configuration.created"
    | "billing_portal.session.created"
  >;
  data: { object: Stripe.BillingPortal.Configuration | Stripe.BillingPortal.Session };
  id: string;
  livemode: boolean;
  created: number;
}

// Master discriminated union — the webhook router narrows to one of these
export type HandledStripeEvent =
  | StripeSubscriptionEvent
  | StripeInvoiceEvent
  | StripeCheckoutEvent
  | StripeCustomerEvent
  | StripeBillingPortalEvent;

// ============================================================
// Type guard helpers
// ============================================================

export function isSubscriptionEvent(event: HandledStripeEvent): event is StripeSubscriptionEvent {
  return event.type.startsWith("customer.subscription.");
}

export function isInvoiceEvent(event: HandledStripeEvent): event is StripeInvoiceEvent {
  return event.type.startsWith("invoice.");
}

export function isCheckoutEvent(event: HandledStripeEvent): event is StripeCheckoutEvent {
  return event.type.startsWith("checkout.session.");
}

export function isCustomerEvent(event: HandledStripeEvent): event is StripeCustomerEvent {
  return (
    event.type === "customer.created" ||
    event.type === "customer.updated" ||
    event.type === "customer.deleted"
  );
}
