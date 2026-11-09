/** Original-lyrics workspace. Pure functions, suitable for browser and server use. */
export type LyricSection = "intro" | "verse" | "pre-chorus" | "chorus" | "bridge" | "outro";
export interface LyricLine { id: string; text: string; section: LyricSection; startSeconds?: number }
export interface LyricDraft { title: string; bpm?: number; key?: string; lines: LyricLine[] }
export function validateLyricDraft(draft: LyricDraft): string[] {
  const issues: string[] = [];
  if (!draft.title.trim()) issues.push("Song title is required");
  if (draft.bpm !== undefined && (!Number.isFinite(draft.bpm) || draft.bpm < 30 || draft.bpm > 300)) issues.push("BPM must be between 30 and 300");
  const ids = new Set<string>();
  for (const line of draft.lines) {
    if (!line.id || ids.has(line.id)) issues.push("Every lyric line needs a unique ID");
    ids.add(line.id);
    if (line.startSeconds !== undefined && (!Number.isFinite(line.startSeconds) || line.startSeconds < 0)) issues.push("Invalid lyric timestamp");
  }
  return issues;
}
export function estimateSyllables(text: string): number {
  return (text.toLowerCase().match(/[aeiouy]+/g) ?? []).length;
}
export function formatLyricSheet(draft: LyricDraft): string {
  const errors = validateLyricDraft(draft);
  if (errors.length) throw new Error(errors.join("; "));
  let section: LyricSection | undefined;
  const output = [draft.title, draft.bpm ? `BPM: ${draft.bpm}` : "", draft.key ? `Key: ${draft.key}` : ""].filter(Boolean);
  for (const line of draft.lines) {
    if (section !== line.section) { section = line.section; output.push("", `[${section.toUpperCase()}]`); }
    output.push(line.text);
  }
  return output.join("\n");
}
export function buildLyricWriterPrompt(input: { concept: string; genre?: string; mood?: string; existingLyrics?: string; instruction?: string }): string {
  if (!input.concept.trim()) throw new Error("A song concept is required");
  return [
    "You are PureMix's original songwriting collaborator. Write fresh lyrics, never imitate or reproduce existing copyrighted lyrics.",
    "Keep hooks memorable, phrases performable, and preserve the user's original words when editing.",
    "Offer clear verse, chorus and bridge sections. Do not claim you analyzed audio unless an audio tool actually ran.",
    `Concept: ${input.concept}`, `Genre: ${input.genre ?? "unspecified"}`,
    `Mood: ${input.mood ?? "unspecified"}`,
    `User request: ${input.instruction ?? "Draft a song"}`,
    input.existingLyrics ? `Existing user lyrics:\n${input.existingLyrics}` : "",
  ].filter(Boolean).join("\n");
}
