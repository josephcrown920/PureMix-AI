// Thin wrapper around the generated API client's customFetch for endpoints
// that aren't yet in the OpenAPI spec (auth/billing).
import { customFetch } from "@workspace/api-client-react";
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

export type PlanLabel = "trial" | "payg" | "day" | "lifetime";
export type PlanId = "single" | "day" | "lifetime";

export interface Entitlement {
  allowed: boolean;
  consumeMode: "lifetime" | "day" | "credit" | "trial" | null;
  label: PlanLabel;
  credits: number;
  dayPassExpiresAt: string | null;
  trialAvailable: boolean;
}

export interface MeResponse {
  id: string;
  email: string | null;
  plan: PlanLabel;
  lifetime: boolean;
  entitlement: Entitlement;
  totalJobs: number;
}

export interface PlanConfig {
  id: PlanId;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  grants: "credit" | "window" | "lifetime";
  windowMs?: number;
}

export interface PlansResponse {
  currency: string;
  plans: PlanConfig[];
}

export const meQueryKey = ["api", "me"] as const;
export const plansQueryKey = ["api", "billing", "plans"] as const;

export function fetchMe(): Promise<MeResponse> {
  return customFetch<MeResponse>("/api/me");
}

export function fetchPlans(): Promise<PlansResponse> {
  return customFetch<PlansResponse>("/api/billing/plans");
}

export function postCheckout(body: {
  plan: PlanId;
  returnUrl: string;
  jobId?: number;
}): Promise<{ authorizationUrl: string; reference: string }> {
  return customFetch("/api/billing/checkout", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function verifyPayment(
  reference: string,
): Promise<{ success: boolean; status: string; plan?: PlanId }> {
  return customFetch(
    `/api/billing/verify?reference=${encodeURIComponent(reference)}`,
  );
}

export function useMe(
  options?: Omit<UseQueryOptions<MeResponse>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: fetchMe,
    retry: 0,
    ...options,
  });
}

export function usePlans() {
  return useQuery({ queryKey: plansQueryKey, queryFn: fetchPlans });
}
