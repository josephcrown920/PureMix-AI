import { Router, type IRouter } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../../lib/logger";
import { requireAuth } from "../../middlewares/requireAuth";
import { aiChatLimiter } from "../../middlewares/rateLimit";
import { validateCustomParams, PARAM_SPECS } from "../../lib/masteringParams";

const router: IRouter = Router();

const VALID_PRESETS = ["streaming", "club", "warm_vinyl", "broadcast", "custom"] as const;
type Preset = (typeof VALID_PRESETS)[number];

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
}

const SYSTEM_PROMPT = `You are Puremix, an AI mastering co-engineer for Afrobeats, amapiano, hip-hop, drill and trap producers.
You are in a back-and-forth chat with the producer. Each turn you do TWO things:

1. Talk like a friendly engineer — ask one focused question OR confirm the next move. Keep it 1-3 short sentences.
2. Update the mastering settings if the producer's intent is clear. Otherwise leave them null/empty.

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

Reference songs:
On the FIRST turn (or any turn where the producer describes a vibe), recommend 2-3 commercially released songs that
sound similar to what they're going for, so they have a sonic reference while you mix. Format each as title, artist,
and a one-line "why" (e.g. "Same wide stereo + warm low end"). If the producer hasn't given enough info, return [].

Set "done": true ONLY when the producer is happy with the settings and ready to render
("yes go", "let's master it", "looks good", "do it", "send it" etc.).

Output STRICT JSON. No prose. No markdown fences. Schema:
{
  "reply": "<short engineer-style reply>",
  "patch": {
    "preset": "<one of the presets, or null if not changing>",
    "customParams": { /* sparse, only the params you're changing */ },
    "generateVariations": <true | false | null>
  },
  "referenceSongs": [
    { "title": "<song>", "artist": "<artist>", "why": "<one line>" }
  ],
  "done": <true | false>
}`;

function parseJsonObject(raw: string): Partial<ChatResponse> | null {
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
        try {
          return JSON.parse(haystack.slice(start, i + 1)) as Partial<ChatResponse>;
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

    // Sanitize: only role+content, length-cap.
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

    const client = getClient();
    if (!client) {
      res.status(503).json({
        error: "AI chat is temporarily unavailable. Pick a preset manually below.",
      });
      return;
    }

    try {
      const response = await client.messages.create(
        {
          model: "claude-haiku-4-5",
          max_tokens: 800,
          system: SYSTEM_PROMPT,
          messages,
        },
        { timeout: 18_000 },
      );

      const textBlock = response.content.find((b) => b.type === "text");
      const raw = textBlock && textBlock.type === "text" ? textBlock.text : "";
      const parsed = parseJsonObject(raw);
      if (!parsed) {
        logger.error({ raw }, "AI chat: no JSON in response");
        res.status(502).json({ error: "Could not parse AI response. Try again." });
        return;
      }

      const rawPatch = (parsed.patch ?? {}) as Partial<ChatPatch>;
      const preset =
        typeof rawPatch.preset === "string" && VALID_PRESETS.includes(rawPatch.preset as Preset)
          ? (rawPatch.preset as Preset)
          : null;
      const customParams = validateCustomParams(rawPatch.customParams) ?? {};
      const generateVariations =
        typeof rawPatch.generateVariations === "boolean" ? rawPatch.generateVariations : null;

      const reply =
        typeof parsed.reply === "string" && parsed.reply.trim().length > 0
          ? parsed.reply.slice(0, 800)
          : "Got it. What's next?";
      const referenceSongs = sanitizeRefs(parsed.referenceSongs);
      const done = parsed.done === true;

      const result: ChatResponse = {
        reply,
        patch: { preset, customParams, generateVariations },
        referenceSongs,
        done,
      };
      res.json(result);
    } catch (err) {
      logger.error({ err }, "AI chat failed");
      res.status(502).json({
        error: "AI service is unreachable. Try again in a moment.",
      });
    }
  },
);

export { router as chatRouter };
