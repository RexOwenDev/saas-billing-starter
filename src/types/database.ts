// ============================================================
// types/database.ts
// Hand-written TypeScript types mirroring the Supabase schema.
// Keep in sync with supabase/migrations/*.sql
// ============================================================

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

// ============================================================
// Enums
// ============================================================

export type SubscriptionStatus =
  | "incomplete"
  | "incomplete_expired"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused";

export type InvoiceStatus = "draft" | "open" | "paid" | "uncollectible" | "void";

export type WebhookProcessingStatus = "processing" | "succeeded" | "failed";

export type OrgMemberRole = "owner" | "admin" | "member";

// ============================================================
// Organizations
// ============================================================

export interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  org_id: string;
  user_id: string;
  role: OrgMemberRole;
  invited_at: string;
  accepted_at: string | null;
}

// ============================================================
// Customers
// ============================================================

export interface Customer {
  id: string;
  org_id: string;
  stripe_customer_id: string;
  email: string;
  name: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Products & Prices
// ============================================================

export interface Product {
  id: string; // Stripe product ID (prod_...)
  name: string;
  description: string | null;
  active: boolean;
  metadata: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export type PriceBillingScheme = "per_unit" | "tiered";
export type PriceUsageType = "licensed" | "metered";
export type PriceInterval = "day" | "week" | "month" | "year";
export type PriceAggregateUsage = "sum" | "last_during_period" | "last_ever" | "max";

export interface Price {
  id: string; // Stripe price ID (price_...)
  product_id: string;
  active: boolean;
  currency: string;
  type: "one_time" | "recurring";
  interval: PriceInterval | null;
  interval_count: number | null;
  unit_amount: number | null; // cents; null for metered
  billing_scheme: PriceBillingScheme;
  usage_type: PriceUsageType;
  aggregate_usage: PriceAggregateUsage | null;
  metadata: Record<string, string>;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Subscriptions
// ============================================================

export interface Subscription {
  id: string; // Stripe subscription ID (sub_...)
  org_id: string;
  customer_id: string;
  status: SubscriptionStatus;
  price_id: string;
  product_id: string;
  quantity: number;
  trial_start: string | null;
  trial_end: string | null;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  cancel_at: string | null;
  created_at: string;
  updated_at: string;
  ended_at: string | null;
  latest_invoice_id: string | null;
  metadata: Record<string, string>;
}

// ============================================================
// Usage Records
// ============================================================

export interface UsageRecord {
  id: string;
  org_id: string;
  subscription_id: string;
  feature: string;
  quantity: number;
  occurred_at: string;
  idempotency_key: string | null;
  stripe_usage_record_id: string | null;
  reported_at: string | null;
  billing_period_start: string;
  billing_period_end: string;
  metadata: Record<string, string>;
  created_at: string;
}

// ============================================================
// Webhook Events
// ============================================================

export interface WebhookEvent {
  id: string;
  stripe_event_id: string;
  event_type: string;
  livemode: boolean;
  status: WebhookProcessingStatus;
  payload: Json | null;
  error_message: string | null;
  received_at: string;
  processed_at: string | null;
  attempt_count: number;
}

// ============================================================
// Invoices
// ============================================================

export interface Invoice {
  id: string; // Stripe invoice ID (in_...)
  org_id: string;
  customer_id: string;
  subscription_id: string | null;
  status: InvoiceStatus;
  amount_due: number; // cents
  amount_paid: number; // cents
  amount_remaining: number; // cents
  currency: string;
  period_start: string | null;
  period_end: string | null;
  due_date: string | null;
  paid_at: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Database shape (for Supabase client generic)
// ============================================================

export interface Database {
  public: {
    Tables: {
      organizations: { Row: Organization; Insert: Omit<Organization, "id" | "created_at" | "updated_at">; Update: Partial<Organization> };
      organization_members: { Row: OrganizationMember; Insert: Omit<OrganizationMember, "id" | "invited_at">; Update: Partial<OrganizationMember> };
      customers: { Row: Customer; Insert: Omit<Customer, "id" | "created_at" | "updated_at">; Update: Partial<Customer> };
      products: { Row: Product; Insert: Omit<Product, "created_at" | "updated_at">; Update: Partial<Product> };
      prices: { Row: Price; Insert: Omit<Price, "created_at" | "updated_at">; Update: Partial<Price> };
      subscriptions: { Row: Subscription; Insert: Omit<Subscription, "created_at" | "updated_at">; Update: Partial<Subscription> };
      usage_records: { Row: UsageRecord; Insert: Omit<UsageRecord, "id" | "created_at">; Update: Partial<UsageRecord> };
      webhook_events: { Row: WebhookEvent; Insert: Omit<WebhookEvent, "id" | "received_at">; Update: Partial<WebhookEvent> };
      invoices: { Row: Invoice; Insert: Omit<Invoice, "created_at" | "updated_at">; Update: Partial<Invoice> };
    };
    Enums: {
      subscription_status: SubscriptionStatus;
      invoice_status: InvoiceStatus;
      webhook_processing_status: WebhookProcessingStatus;
      org_member_role: OrgMemberRole;
    };
  };
}
