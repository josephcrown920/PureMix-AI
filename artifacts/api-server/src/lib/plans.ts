export type PlanId = "free" | "pro" | "lifetime";

export interface PlanConfig {
  id: PlanId;
  name: string;
  description: string;
  monthlyJobLimit: number | null; // null = unlimited
  priceCents: number; // in smallest currency unit
  currency: string;
  interval: "month" | "one_time" | null;
}

export const CURRENCY = process.env.PAYSTACK_CURRENCY ?? "USD";

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: "free",
    name: "Free",
    description: "Perfect for trying out Puremix.ai",
    monthlyJobLimit: 3,
    priceCents: 0,
    currency: CURRENCY,
    interval: null,
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "Unlimited masters, billed monthly",
    monthlyJobLimit: null,
    priceCents: 999,
    currency: CURRENCY,
    interval: "month",
  },
  lifetime: {
    id: "lifetime",
    name: "Lifetime",
    description: "Pay once, master forever",
    monthlyJobLimit: null,
    priceCents: 9900,
    currency: CURRENCY,
    interval: "one_time",
  },
};

export function getJobLimit(plan: PlanId): number | null {
  return PLANS[plan].monthlyJobLimit;
}
