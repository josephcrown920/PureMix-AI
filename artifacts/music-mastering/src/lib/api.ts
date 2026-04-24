// Thin wrapper around the generated API client's customFetch for endpoints
// that aren't yet in the OpenAPI spec (auth/billing).
import { customFetch } from "@workspace/api-client-react";
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

export interface MeResponse {
  id: string;
  email: string | null;
  plan: "free" | "pro" | "lifetime";
  lifetime: boolean;
  proRenewsAt: string | null;
  usage: {
    monthlyJobs: number;
    monthlyJobLimit: number | null;
    remaining: number | null;
    periodStart: string;
  };
  planConfig: {
    id: string;
    name: string;
    description: string;
    monthlyJobLimit: number | null;
    priceCents: number;
    currency: string;
    interval: "month" | "one_time" | null;
  };
}

export interface PlansResponse {
  currency: string;
  plans: MeResponse["planConfig"][];
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
  plan: "pro" | "lifetime";
  returnUrl: string;
}): Promise<{ authorizationUrl: string; reference: string }> {
  return customFetch("/api/billing/checkout", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function verifyPayment(reference: string): Promise<{ success: boolean; status: string }> {
  return customFetch(`/api/billing/verify?reference=${encodeURIComponent(reference)}`);
}

export function postCancelSubscription(): Promise<{ success: boolean }> {
  return customFetch("/api/billing/cancel", { method: "POST" });
}

export function useMe(options?: Omit<UseQueryOptions<MeResponse>, "queryKey" | "queryFn">) {
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
