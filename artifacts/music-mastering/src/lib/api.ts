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

// ---------------------------------------------------------------------------
// Phase 2 mastering extensions (Total Control + AI Variations)
// These fields aren't yet in the OpenAPI spec, so we model them locally and
// cast the generated MasteringJob at the boundary.
// ---------------------------------------------------------------------------

export interface MasteringVariant {
  id: string;
  label: string;
  description: string;
  outputLufs: number;
}

export interface MasteringJobExtra {
  customParams: Record<string, number | boolean> | null;
  variants: MasteringVariant[] | null;
  selectedVariantId: string | null;
}

export interface CreateMasteringJobOptions {
  preset: string;
  targetLufs?: number | null;
  customParams?: Record<string, number | boolean> | null;
  generateVariations?: boolean;
}

/**
 * Create a mastering job with the new Total Control + Variations fields.
 * Bypasses the auto-generated client (which only knows audio + preset +
 * targetLufs) so we can ship without regenerating the OpenAPI spec.
 */
export async function createMasteringJob(
  audio: File,
  opts: CreateMasteringJobOptions,
): Promise<{ id: number } & Record<string, unknown>> {
  const fd = new FormData();
  fd.append("audio", audio);
  fd.append("preset", opts.preset);
  if (opts.targetLufs != null) fd.append("targetLufs", String(opts.targetLufs));
  if (opts.customParams && Object.keys(opts.customParams).length > 0) {
    fd.append("customParams", JSON.stringify(opts.customParams));
  }
  if (opts.generateVariations) fd.append("generateVariations", "true");
  return customFetch<{ id: number } & Record<string, unknown>>(
    "/api/mastering/jobs",
    { method: "POST", body: fd },
  );
}

// ---------------------------------------------------------------------------
// AI Suggestion
// ---------------------------------------------------------------------------

export type SuggestPreset =
  | "streaming"
  | "club"
  | "warm_vinyl"
  | "broadcast"
  | "custom";

export interface SuggestResponse {
  preset: SuggestPreset;
  customParams: Record<string, number | boolean>;
  rationale: string;
  generateVariations: boolean;
}

export function fetchSuggestion(description: string): Promise<SuggestResponse> {
  return customFetch<SuggestResponse>("/api/mastering/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
  });
}

/** Pick which AI variation becomes the canonical master. */
export function selectMasteringVariant(
  jobId: number,
  variantId: string,
): Promise<unknown> {
  return customFetch(`/api/mastering/jobs/${jobId}/variant`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ variantId }),
  });
}

// ---------------------------------------------------------------------------
// Prompt-mixing chat (multi-turn) + reference song suggestions
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ReferenceSong {
  title: string;
  artist: string;
  why: string;
}

export interface ChatPatch {
  preset: SuggestPreset | null;
  customParams: Record<string, number | boolean>;
  generateVariations: boolean | null;
}

export interface ChatResponse {
  reply: string;
  patch: ChatPatch;
  referenceSongs: ReferenceSong[];
  done: boolean;
}

export function postChat(messages: ChatMessage[]): Promise<ChatResponse> {
  return customFetch<ChatResponse>("/api/mastering/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
}

// ---------------------------------------------------------------------------
// Lyrics transcription (Whisper, included with any paid master)
// ---------------------------------------------------------------------------

export interface LyricsResponse {
  text: string;
  language: string | null;
}

export function postLyrics(jobId: number): Promise<LyricsResponse> {
  return customFetch<LyricsResponse>(`/api/mastering/jobs/${jobId}/lyrics`, {
    method: "POST",
  });
}
