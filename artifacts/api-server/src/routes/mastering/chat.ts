import { Router, type IRouter } from "express";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { logger } from "../../lib/logger";
import { requireAuth } from "../../middlewares/requireAuth";
import { aiChatLimiter } from "../../middlewares/rateLimit";
import { validateCustomParams, PARAM_SPECS } from "../../lib/masteringParams";
import { db, masteringJobsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const VALID_PRESETS = ["streaming", "club", "warm_vinyl", "broadcast", "custom"] as const;
type Preset = (typeof VALID_PRESETS)[number];
type Provider = "claude" | "openai";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ReferenceSong {
  title: string;
  artist: string;
  why: string;
}

interface ChatPatch {
  preset: Preset | null;
  customParams: Record<string, number | boolean>;
  generateVariations: boolean | null;
}

interface ChatResponse {
  reply: string;
  patch: ChatPatch;
  referenceSongs: ReferenceSong[];
  done: boolean;
  provider: Provider;
}

interface AudioAnalysis {
  integrated_lufs: number;
  loudness_range: number;
  true_peak_dbfs: number;
  rms_db: number;
  crest_factor_db: number;
  spectral_centroid_hz: number;
  low_energy_ratio: number;
  mid_energy_ratio: number;
  high_energy_ratio: number;
  stereo_width: number;
  duration_sec: number;
  sample_rate: number;
}

function buildSystemPrompt(analysis: AudioAnalysis | null): string {
  const base = `You are Puremix, an AI mastering co-engineer for Afrobeats, amapiano, hip-hop, drill and trap producers.
You are in a back-and-forth chat with the producer. Each turn you do TWO things:

1. Talk like a friendly engineer — ask one focused question OR confirm the next move. Keep it 1-3 short sentences.
2. Update the mastering settings if the producer's intent is clear. Otherwise leave them null/empty.

Available presets:
- "streaming"   target -14 LUFS, balanced for Spotify/Apple Music.
- "club"        target  -7 LUFS, very loud, heavy limiting, peak energy for DJs.
- "warm_vinyl"  target -12 LUFS, analog warmth, preserved transients, richer low end.
- "broadcast"   target -23 LUFS, EBU R128 strict, for TV/radio.
- "custom"      use only when fine-grained customParams are essential.

You may include sparse customParams to fine-tune. Keys & ranges:
${Object.entries(PARAM_SPECS).map(([k, s]) => `  ${k} (${s.type}, ${s.min}..${s.max})`).join("\n")}

Reference songs:
On the FIRST turn (or any turn where the producer describes a vibe), recommend 2-3 commercially released songs that
sound similar, so they have a sonic reference. Format each as title, artist, and a one-line "why".
If the producer hasn't given enough info, return [].

Set "done": true ONLY when the producer is happy and ready to render ("yes go", "send it", "looks good", etc.).

Output STRICT JSON. No prose. No markdown fences. Schema:
{
  "reply": "<short engineer-style reply>",
  "patch": {
    "preset": "<preset or null>",
    "customParams": {},
    "generateVariations": <true | false | null>
  },
  "referenceSongs": [{ "title": "", "artist": "", "why": "" }],
  "done": <true | false>
}`;

  if (!analysis) return base;

  const lufsGap = -14 - analysis.integrated_lufs;
  const bassProfile = analysis.low_energy_ratio > 0.42
    ? "heavy bass — careful with low-shelf boosts"
    : analysis.low_energy_ratio < 0.20
    ? "thin low-end — could use warmth"
    : "balanced low-end";
  const dynProfile = analysis.loudness_range > 12
    ? "very dynamic — needs compression"
    : analysis.loudness_range < 3
    ? "already brick-walled — be very gentle"
    : "healthy dynamics";
  const widthProfile = analysis.stereo_width < 0.15
    ? "near-mono"
    : analysis.stereo_width > 0.75
    ? "extremely wide (phase risk)"
    : "good stereo image";

  return `${base}

MEASURED AUDIO PROPERTIES (from the actual uploaded file):
- Integrated: ${analysis.integrated_lufs} LUFS (${lufsGap > 0 ? "+" : ""}${lufsGap.toFixed(1)} dB needed for streaming)
- LRA (dynamic range): ${analysis.loudness_range} dB — ${dynProfile}
- Crest factor: ${analysis.crest_factor_db} dB (${analysis.crest_factor_db > 14 ? "punchy transients" : analysis.crest_factor_db < 8 ? "flat/squashed" : "moderate"})
- Spectral centroid: ${analysis.spectral_centroid_hz.toFixed(0)} Hz (${analysis.spectral_centroid_hz < 1200 ? "dark/warm" : analysis.spectral_centroid_hz > 4000 ? "bright" : "balanced"})
- Low energy: ${(analysis.low_energy_ratio * 100).toFixed(1)}% — ${bassProfile}
- Stereo width: ${(analysis.stereo_width * 100).toFixed(0)}% — ${widthProfile}

Refer to these numbers naturally — e.g. "Your track is at ${analysis.integrated_lufs} LUFS, so it needs a solid gain push for streaming."`;
}

function parseJsonObject(raw: string): Partial<ChatResponse> | null {
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const haystack = fenced ? fenced[1] : raw;
  const start = haystack.indexOf("{");
  if (start === -1) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < haystack.length; i++) {
    const c = haystack[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(haystack.slice(start, i + 1)) as Partial<ChatResponse>; }
        catch { return null; }
      }
    }
  }
  return null;
}

function getClaudeClient(): Anthropic | null {
  const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
  if (!baseURL || !apiKey) return null;
  return new Anthropic({ baseURL, apiKey });
}

function getOpenAIClient(): OpenAI | null {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseURL || !apiKey) return null;
  return new OpenAI({ baseURL, apiKey });
}

function sanitizeRefs(input: unknown): ReferenceSong[] {
  if (!Array.isArray(input)) return [];
  const out: ReferenceSong[] = [];
  for (const r of input) {
    if (!r || typeof r !== "object") continue;
    const rec = r as Record<string, unknown>;
    const title = typeof rec.title === "string" ? rec.title.slice(0, 120) : "";
    const artist = typeof rec.artist === "string" ? rec.artist.slice(0, 120) : "";
    const why = typeof rec.why === "string" ? rec.why.slice(0, 200) : "";
    if (title && artist) out.push({ title, artist, why });
    if (out.length >= 5) break;
  }
  return out;
}

router.post(
  "/mastering/chat",
  requireAuth,
  aiChatLimiter,
  async (req, res): Promise<void> => {
    const rawMessages = Array.isArray(req.body?.messages) ? req.body.messages : null;
    if (!rawMessages || rawMessages.length === 0 || rawMessages.length > 20) {
      res.status(400).json({ error: "Send 1-20 chat messages." });
      return;
    }

    const messages: ChatMessage[] = [];
    for (const m of rawMessages) {
      if (!m || typeof m !== "object") continue;
      const role = m.role === "assistant" ? "assistant" : "user";
      const content = typeof m.content === "string" ? m.content.slice(0, 4000).trim() : "";
      if (!content) continue;
      messages.push({ role, content });
    }
    if (messages.length === 0) {
      res.status(400).json({ error: "No valid messages." });
      return;
    }

    const provider: Provider = req.body?.provider === "openai" ? "openai" : "claude";

    // Look up audio analysis if jobId provided
    let analysis: AudioAnalysis | null = null;
    const rawJobId = req.body?.jobId;
    if (typeof rawJobId === "number") {
      try {
        const [job] = await db
          .select({ audioAnalysis: masteringJobsTable.audioAnalysis })
          .from(masteringJobsTable)
          .where(eq(masteringJobsTable.id, rawJobId));
        if (job?.audioAnalysis) analysis = job.audioAnalysis as AudioAnalysis;
      } catch (e) {
        logger.warn({ e, jobId: rawJobId }, "Could not fetch job analysis for chat");
      }
    }

    const systemPrompt = buildSystemPrompt(analysis);

    try {
      let raw = "";

      if (provider === "openai") {
        const client = getOpenAIClient();
        if (!client) {
          res.status(503).json({ error: "OpenAI is temporarily unavailable. Try Claude instead." });
          return;
        }
        const response = await client.chat.completions.create(
          {
            model: "gpt-4o",
            max_tokens: 1000,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              ...messages,
            ],
          },
          { timeout: 25_000 },
        );
        raw = response.choices[0]?.message?.content ?? "";
      } else {
        const client = getClaudeClient();
        if (!client) {
          res.status(503).json({ error: "AI chat is temporarily unavailable." });
          return;
        }
        const response = await client.messages.create(
          {
            model: "claude-sonnet-4-5",
            max_tokens: 1000,
            system: systemPrompt,
            messages,
          },
          { timeout: 25_000 },
        );
        const textBlock = response.content.find((b) => b.type === "text");
        raw = textBlock?.type === "text" ? textBlock.text : "";
      }

      const parsed = parseJsonObject(raw);
      if (!parsed) {
        logger.error({ raw, provider }, "AI chat: no JSON in response");
        res.status(502).json({ error: "Could not parse AI response. Try again." });
        return;
      }

      const rawPatch = (parsed.patch ?? {}) as Partial<ChatPatch>;
      const preset =
        typeof rawPatch.preset === "string" && VALID_PRESETS.includes(rawPatch.preset as Preset)
          ? (rawPatch.preset as Preset) : null;
      const customParams = validateCustomParams(rawPatch.customParams) ?? {};
      const generateVariations =
        typeof rawPatch.generateVariations === "boolean" ? rawPatch.generateVariations : null;

      const reply = typeof parsed.reply === "string" && parsed.reply.trim().length > 0
        ? parsed.reply.slice(0, 1000) : "Got it. What's next?";
      const referenceSongs = sanitizeRefs(parsed.referenceSongs);
      const done = parsed.done === true;

      res.json({
        reply, referenceSongs, done, provider,
        patch: { preset, customParams, generateVariations },
      } satisfies ChatResponse);
    } catch (err) {
      logger.error({ err, provider }, "AI chat failed");
      res.status(502).json({ error: "AI service is unreachable. Try again in a moment." });
    }
  },
);

export { router as chatRouter };
