import crypto from "crypto";
import { logger } from "./logger";

const PAYSTACK_BASE = "https://api.paystack.co";

function secret(): string {
  const k = process.env.PAYSTACK_SECRET_KEY;
  if (!k) throw new Error("PAYSTACK_SECRET_KEY is not set");
  return k;
}

async function paystackFetch<T = any>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const data = (await res.json()) as any;
  if (!res.ok || data?.status === false) {
    const msg = data?.message ?? `Paystack ${path} failed (HTTP ${res.status})`;
    logger.error({ path, status: res.status, data }, "Paystack request failed");
    throw new Error(msg);
  }
  return data as T;
}

export interface InitTransactionInput {
  email: string;
  amountCents: number;
  currency: string;
  callbackUrl: string;
  reference?: string;
  plan?: string; // Paystack plan_code for subscriptions
  metadata?: Record<string, unknown>;
}

export async function initializeTransaction(input: InitTransactionInput): Promise<{
  authorization_url: string;
  access_code: string;
  reference: string;
}> {
  const body: Record<string, unknown> = {
    email: input.email,
    amount: input.amountCents,
    currency: input.currency,
    callback_url: input.callbackUrl,
  };
  if (input.reference) body.reference = input.reference;
  if (input.plan) body.plan = input.plan;
  if (input.metadata) body.metadata = input.metadata;

  const res = await paystackFetch<{ data: any }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function verifyTransaction(reference: string): Promise<any> {
  const res = await paystackFetch<{ data: any }>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
  );
  return res.data;
}

export async function createPlan(input: {
  name: string;
  amountCents: number;
  interval: "monthly" | "yearly";
  currency: string;
}): Promise<{ plan_code: string; id: number }> {
  const res = await paystackFetch<{ data: any }>("/plan", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      amount: input.amountCents,
      interval: input.interval,
      currency: input.currency,
    }),
  });
  return res.data;
}

export async function listPlans(): Promise<any[]> {
  const res = await paystackFetch<{ data: any[] }>("/plan?perPage=100");
  return res.data;
}

export async function disableSubscription(input: {
  code: string;
  token: string;
}): Promise<void> {
  await paystackFetch("/subscription/disable", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
  if (!signature) return false;
  const computed = crypto
    .createHmac("sha512", secret())
    .update(rawBody)
    .digest("hex");
  // Use timingSafeEqual but only when lengths match
  if (computed.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
}

/**
 * Resolve (or create) the Paystack plan_code for a given internal plan id.
 * Cached in-memory once resolved.
 */
const planCodeCache: Record<string, string> = {};

export async function ensurePaystackPlan(
  internalId: "pro",
  amountCents: number,
  currency: string,
): Promise<string> {
  if (planCodeCache[internalId]) return planCodeCache[internalId];

  // Allow override via env
  const envCode = process.env[`PAYSTACK_PLAN_CODE_${internalId.toUpperCase()}`];
  if (envCode) {
    planCodeCache[internalId] = envCode;
    return envCode;
  }

  const name = `MasterAI ${internalId.toUpperCase()}`;
  const plans = await listPlans();
  const existing = plans.find(
    (p) =>
      p.name === name &&
      p.amount === amountCents &&
      p.currency?.toUpperCase() === currency.toUpperCase() &&
      p.interval === "monthly",
  );
  if (existing) {
    planCodeCache[internalId] = existing.plan_code;
    return existing.plan_code;
  }

  const created = await createPlan({
    name,
    amountCents,
    interval: "monthly",
    currency,
  });
  planCodeCache[internalId] = created.plan_code;
  logger.info({ planCode: created.plan_code, name }, "Created Paystack plan");
  return created.plan_code;
}
