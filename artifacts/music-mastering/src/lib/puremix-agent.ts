/** Auditable agent plan; the caller must execute approved tools, never pretend an action happened. */
export type PureMixAction =
  | { type: "separate_stems"; trackId: string; stems: string[] }
  | { type: "set_track_mute"; trackId: string; muted: boolean }
  | { type: "add_stem_track"; stemId: string; sourceTrackId: string }
  | { type: "write_lyrics"; concept: string; genre?: string }
  | { type: "master_preview"; trackId: string; targetLufs?: number };
export interface PureMixAgentPlan { goal: string; steps: PureMixAction[]; requiresApproval: boolean; status: "planned" }
export function planPureMixRequest(input: { instruction: string; selectedTrackId?: string }): PureMixAgentPlan {
  const goal = input.instruction.trim();
  if (!goal) throw new Error("Instruction is required");
  const normalized = goal.toLowerCase();
  const trackId = input.selectedTrackId;
  if (/\b(lyrics|songwrite|write a (verse|hook|chorus|song))\b/.test(normalized)) {
    return { goal, steps: [{ type: "write_lyrics", concept: goal }], requiresApproval: false, status: "planned" };
  }
  if (/\b(isolate|separate|extract|split)\b/.test(normalized)) {
    if (!trackId) throw new Error("Select a track before separating stems");
    const stems = /\b(drums?)\b/.test(normalized) ? ["drums"] : /\b(bass)\b/.test(normalized) ? ["bass"] : ["vocals"];
    return { goal, steps: [{ type: "separate_stems", trackId, stems }], requiresApproval: true, status: "planned" };
  }
  if (/\b(master|mastering)\b/.test(normalized)) {
    if (!trackId) throw new Error("Select a track before mastering");
    return { goal, steps: [{ type: "master_preview", trackId }], requiresApproval: true, status: "planned" };
  }
  throw new Error("Unsupported request: agent must ask for clarification rather than invent an action");
}
export function agentActionSucceeded(result: { ok: boolean; outputTrackIds?: string[] }): boolean {
  return result.ok === true;
}
