import Stripe from "stripe";

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY未設定");
  client = new Stripe(key);
  return client;
}

export const STRIPE_PRICE_STANDARD = process.env.STRIPE_PRICE_STANDARD;
export const STRIPE_PRICE_PREMIUM = process.env.STRIPE_PRICE_PREMIUM;
