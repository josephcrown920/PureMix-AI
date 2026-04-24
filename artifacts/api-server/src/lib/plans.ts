import type { User } from "@workspace/db";

export type PlanId = "single" | "day" | "lifetime";
export type PlanLabel = "trial" | "payg" | "day" | "lifetime";

export interface PlanConfig {
  id: PlanId;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  // 'credit' = grants +1 master credit. 'window' = grants 24h unlimited.
  // 'lifetime' = grants permanent unlimited.
  grants: "credit" | "window" | "lifetime";
  // For 'window' grants: window length in milliseconds.
  windowMs?: number;
}

export const CURRENCY = process.env.PAYSTACK_CURRENCY ?? "USD";

export const PLANS: Record<PlanId, PlanConfig> = {
  single: {
    id: "single",
    name: "Single Master",
    description: "Master one track. Pay as you go.",
    priceCents: 200,
    currency: CURRENCY,
    grants: "credit",
  },
  day: {
    id: "day",
    name: "24-Hour Pass",
    description: "Unlimited masters for 24 hours.",
    priceCents: 1000,
    currency: CURRENCY,
    grants: "window",
    windowMs: 24 * 60 * 60 * 1000,
  },
  lifetime: {
    id: "lifetime",
    name: "Lifetime",
    description: "Unlimited masters forever. One payment.",
    priceCents: 20000,
    currency: CURRENCY,
    grants: "lifetime",
  },
};

export interface Entitlement {
  allowed: boolean;
  // The mode that would be consumed if a master were submitted right now.
  consumeMode: "lifetime" | "day" | "credit" | "trial" | null;
  label: PlanLabel;
  credits: number;
  dayPassExpiresAt: string | null;
  trialAvailable: boolean;
}

export function computeEntitlement(user: User): Entitlement {
  const now = Date.now();
  const dayActive =
    !!user.dayPassExpiresAt && new Date(user.dayPassExpiresAt).getTime() > now;
  const dayPassExpiresAt = dayActive
    ? new Date(user.dayPassExpiresAt!).toISOString()
    : null;
  const trialAvailable = !user.freeTrialUsed;

  let consumeMode: Entitlement["consumeMode"] = null;
  if (user.lifetime) consumeMode = "lifetime";
  else if (dayActive) consumeMode = "day";
  else if ((user.credits ?? 0) > 0) consumeMode = "credit";
  else if (trialAvailable) consumeMode = "trial";

  let label: PlanLabel = "trial";
  if (user.lifetime) label = "lifetime";
  else if (dayActive) label = "day";
  else if ((user.credits ?? 0) > 0) label = "payg";

  return {
    allowed: consumeMode !== null,
    consumeMode,
    label,
    credits: user.credits ?? 0,
    dayPassExpiresAt,
    trialAvailable,
  };
}
