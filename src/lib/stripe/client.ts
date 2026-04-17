import "server-only";
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing STRIPE_SECRET_KEY environment variable");
}

// Singleton — module cache ensures one instance per server process.
// Never import this from a 'use client' component: "server-only" enforces that.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-01-27.acacia",
  typescript: true,
  appInfo: {
    name: "saas-billing-starter",
    url: "https://github.com/RexOwenDev/saas-billing-starter",
  },
});
