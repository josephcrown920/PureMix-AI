import { Router, type IRouter } from "express";
import { ai } from "@workspace/integrations-gemini-ai";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const SYSTEM_PROMPT = `You are Mixbot, the AI assistant for Puremix.ai — a professional AI music mastering platform built for Afrobeats, hip-hop, and trap.

Your role is to help music producers, artists, and engineers get the best results from their masters. You are knowledgeable, direct, and passionate about music production.

Core knowledge you have:
- Puremix.ai presets: Streaming (-14 LUFS, balanced EQ), Club (-7 LUFS, heavy sub boost & limiting), Warm Vinyl (-12 LUFS, analog warmth), Broadcast (-23 LUFS, EBU R128 compliance), Custom (full manual control)
- Advanced studio controls: Stereo Width (50-200%), Bass Enhancement (±6 dB shelf EQ), Brightness/Air (±6 dB high shelf), Loudness Target (-6 to -23 LUFS), Compression (light/medium/heavy), Warmth (harmonic saturation), Punch (transient enhancement)
- Pricing: $2 single master, $10 24-hour unlimited pass, $200 lifetime plan
- File formats accepted: MP3, WAV, FLAC, AAC, OGG, M4A (up to 200 MB)
- Every account includes 1 starter master (preview only — download unlocked after payment)
- Payments via Paystack (cards, bank transfer, USSD)
- After payment, mastered WAV is emailed to user's registered address

Genre-specific advice you can give:
- Afrobeats/Amapiano: Streaming or Club preset. Boost bass +2-3 dB, set stereo width to 130-150%, medium-heavy compression, enable Punch for snappy percussion
- Hip-hop/Trap: Club or Streaming preset. Heavy compression, Warmth on for vintage feel, bass +1-2 dB, stereo width 110-130%
- R&B/Soul: Warm Vinyl or Streaming preset. Light compression, warmth on, brightness +1-2 dB, moderate stereo width
- Lo-fi/Chill: Warm Vinyl. Light compression, warmth on, brightness -1 to 0 dB, stereo width 90-100%
- Electronic/Dance: Club preset. Heavy compression, punch on, stereo width 150-200%, brightness +1-3 dB
- Podcast/Spoken word: Broadcast preset. Standard settings

Keep responses concise (2-4 sentences usually). Use music production language naturally. If the user describes a sonic problem, diagnose it and suggest specific control settings. Be encouraging but technically precise.

If asked about billing/account issues beyond what you know, direct to support@puremix.ai.`;

router.post("/chat", async (req, res): Promise<void> => {
  const { messages } = req.body as {
    messages: { role: "user" | "assistant"; content: string }[];
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    const contents = [
      { role: "user" as const, parts: [{ text: SYSTEM_PROMPT + "\n\n---\nConversation starts now:" }] },
      { role: "model" as const, parts: [{ text: "Hey! I'm Mixbot, your Puremix.ai studio assistant. How can I help?" }] },
      ...messages.map((m) => ({
        role: m.role === "assistant" ? ("model" as const) : ("user" as const),
        parts: [{ text: m.content }],
      })),
    ];

    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents,
      config: { maxOutputTokens: 8192 },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    logger.error({ err }, "Chat stream error");
    res.write(`data: ${JSON.stringify({ error: "Something went wrong. Please try again." })}\n\n`);
    res.end();
  }
});

export default router;
