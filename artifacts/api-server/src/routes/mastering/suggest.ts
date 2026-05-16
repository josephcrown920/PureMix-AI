import { Router, type IRouter } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../../lib/logger";
import { requireAuth } from "../../middlewares/requireAuth";
import { aiSuggestLimiter } from "../../middlewares/rateLimit";
import { validateCustomParams, PARAM_SPECS } from "../../lib/masteringParams";
import { db, masteringJobsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const VALID_PRESETS = ["streaming", "club", "warm_vinyl", "broadcast", "custom"] as const;
type Preset = (typeof VALID_PRESETS)[number];

interface SuggestResponse {
  preset: Preset;
  customParams: Record<string, number | boolean>;
  rationale: string;
  generateVariations: boolean;
}

function buildSystemPrompt(analysis: AudioAnalysis | null): string {
  const basePrompt = `You are a senior mastering engineer specializing in Afrobeats, amapiano, hip-hop, and trap music.
The user describes their track in plain English. You return a JSON recommendation for the Puremix.ai mastering engine.

Available presets:
- "streaming"   target -14 LUFS, balanced for Spotify/Apple Music. Default safe choice.
- "club"        target  -7 LUFS, very loud, heavy limiting, peak energy for DJs.
- "warm_vinyl"  target -12 LUFS, analog warmth, preserved transients, richer low end.
- "broadcast"   target -23 LUFS, EBU R128 strict, for TV/radio.
- "custom"      use only when fine-grained customParams are essential.

You may include sparse customParams to fine-tune. Keys & ranges:
${Object.entries(PARAM_SPECS)
  .map(([k, s]) => `  ${k} (${s.type}, ${s.min}..${s.max})`)
  .join("\n")}

Rules:
- Only set customParams when they meaningfully shape the requested sound. Otherwise leave it {}.
- Never invent unknown keys or values outside the ranges above.
- generateVariations=true ONLY if the user is undecided ("not sure", "I want options", "let me hear a few", etc.).
- rationale: 2-3 sentences in plain language, referencing the actual measurements where relevant. No jargon dump.
- Output STRICT JSON. No prose. No markdown fences.

Style cheats for African / hip-hop / trap:
- Afrobeats / amapiano: warm low end (low_shelf_db +1.5..+3 around 80-120Hz), gentle presence, stereo_width 1.05-1.15.
- Trap / drill: aggressive 808 push (low_shelf_db +2..+4 at 60-90Hz), tight transients (transient_attack 0.2..0.5), saturation 0.2-0.4.
- Hip-hop boom-bap: warm_vinyl preset, light compression, transient_sustain +0.1..+0.3.
- Voice-forward (rap, podcast): voice_cleanup=true, presence_db +1..+3 at 3-5kHz, denoise 0.2-0.4.
- "Loud for the club": preset=club, limiter_ceiling_db -0.3, saturation 0.15-0.25.
- "Streaming-safe": preset=streaming, no aggressive customParams.`;

  if (!analysis) return basePrompt;

  const lufsGap = -14 - analysis.integrated_lufs;
  const bassProfile = analysis.low_energy_ratio > 0.42
    ? "bass-heavy (reduce low shelf to avoid muddiness)"
    : analysis.low_energy_ratio < 0.20
    ? "thin/bright (could use low-end warmth)"
    : "balanced low-end";

  const dynamicsProfile = analysis.loudness_range > 12
    ? "very dynamic — will benefit from more compression"
    : analysis.loudness_range < 3
    ? "already heavily compressed — use very gentle settings"
    : analysis.loudness_range < 6
    ? "moderately compressed — light glue compression"
    : "healthy dynamics";

  const widthProfile = analysis.stereo_width < 0.15
    ? "nearly mono — consider widening"
    : analysis.stereo_width > 0.75
    ? "extremely wide — may have phase issues, be careful with stereo_width"
    : "good stereo image";

  const brightnessProfile = analysis.spectral_centroid_hz < 1200
    ? "dark/warm — can add air shelf"
    : analysis.spectral_centroid_hz > 4000
    ? "very bright — avoid boosting highs"
    : "balanced brightness";

  return `${basePrompt}

MEASURED AUDIO CHARACTERISTICS (from the actual uploaded file — use these to make specific, grounded recommendations):
- Integrated loudness: ${analysis.integrated_lufs} LUFS (needs ${lufsGap > 0 ? "+" : ""}${lufsGap.toFixed(1)} dB gain for streaming at -14 LUFS)
- Dynamic range (LRA): ${analysis.loudness_range} dB — ${dynamicsProfile}
- True peak: ${analysis.true_peak_dbfs} dBFS
- Crest factor: ${analysis.crest_factor_db} dB (${analysis.crest_factor_db > 14 ? "punchy, transient-rich" : analysis.crest_factor_db < 8 ? "flat, transients are squashed" : "moderate dynamics"})
- Spectral centroid: ${analysis.spectral_centroid_hz} Hz — ${brightnessProfile}
- Low energy ratio: ${(analysis.low_energy_ratio * 100).toFixed(1)}% — ${bassProfile}
- Stereo width: ${(analysis.stereo_width * 100).toFixed(0)}% — ${widthProfile}
- Duration: ${analysis.duration_sec.toFixed(1)}s

Ground your recommendation in these measurements. For example, if the track is already bass-heavy, don't add more low shelf. If LRA is high, use stronger compression.`;
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

const RESPONSE_SCHEMA = {
  type: "object",
  required: ["preset", "customParams", "rationale", "generateVariations"],
  properties: {
    preset: { type: "string", enum: VALID_PRESETS },
    customParams: { type: "object" },
    rationale: { type: "string" },
    generateVariations: { type: "boolean" },
  },
} as const;

function parseJsonObject(raw: string): Partial<SuggestResponse> | null {
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const haystack = fenced ? fenced[1] : raw;

  const start = haystack.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inStr = false;
  let esc = false;
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
        const candidate = haystack.slice(start, i + 1);
        try {
          return JSON.parse(candidate) as Partial<SuggestResponse>;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function getClient(): Anthropic | null {
  const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
  if (!baseURL || !apiKey) return null;
  return new Anthropic({ baseURL, apiKey });
}

router.post(
  "/mastering/suggest",
  requireAuth,
  aiSuggestLimiter,
  async (req, res): Promise<void> => {
    const description = typeof req.body?.description === "string"
      ? req.body.description.trim()
      : "";
    if (!description || description.length < 4) {
      res.status(400).json({
        error: "Describe your track in a sentence or two so we can suggest a master.",
      });
      return;
    }
    if (description.length > 1000) {
      res.status(400).json({ error: "Description too long (max 1000 chars)." });
      return;
    }

    const client = getClient();
    if (!client) {
      res.status(503).json({
        error: "AI suggestions are temporarily unavailable. Pick a preset manually below.",
      });
      return;
    }

    // Optionally look up audio analysis from the job if jobId is provided.
    // This makes suggestions grounded in actual measured track properties.
    let analysis: AudioAnalysis | null = null;
    const rawJobId = req.body?.jobId;
    if (rawJobId && typeof rawJobId === "number") {
      try {
        const [job] = await db
          .select({ audioAnalysis: masteringJobsTable.audioAnalysis })
          .from(masteringJobsTable)
          .where(eq(masteringJobsTable.id, rawJobId));
        if (job?.audioAnalysis) {
          analysis = job.audioAnalysis as AudioAnalysis;
        }
      } catch (e) {
        logger.warn({ e, jobId: rawJobId }, "Could not fetch job analysis for suggest");
      }
    }

    const systemPrompt = buildSystemPrompt(analysis);

    try {
      const response = await client.messages.create(
        {
          model: "claude-sonnet-4-5",
          max_tokens: 800,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: `Track description: ${description}\n\nReturn a JSON object matching this schema:\n${JSON.stringify(RESPONSE_SCHEMA)}`,
            },
          ],
        },
        { timeout: 20_000 },
      );

      const textBlock = response.content.find((b) => b.type === "text");
      const raw = textBlock && textBlock.type === "text" ? textBlock.text : "";
      const parsed = parseJsonObject(raw);
      if (!parsed) {
        logger.error({ raw }, "AI suggest: no JSON in response");
        res.status(502).json({ error: "Could not parse AI response. Try again." });
        return;
      }
      const preset: Preset = VALID_PRESETS.includes(parsed.preset as Preset)
        ? (parsed.preset as Preset)
        : "streaming";
      const customParams = validateCustomParams(parsed.customParams) ?? {};
      const rationale = typeof parsed.rationale === "string"
        ? parsed.rationale.slice(0, 800)
        : "Recommended based on your description.";
      const generateVariations = parsed.generateVariations === true;

      const result: SuggestResponse = { preset, customParams, rationale, generateVariations };
      res.json(result);
    } catch (err) {
      logger.error({ err }, "AI suggest failed");
      res.status(502).json({
        error: "AI service is unreachable. Pick a preset manually below.",
      });
    }
  },
);

export { router as suggestRouter };
