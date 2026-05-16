import React, { useEffect, useRef, useState } from "react";
import { Sparkles, Loader2, Wand2, Send, Music3, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  postChat,
  type SuggestPreset,
  type ChatMessage,
  type ChatPatch,
  type ReferenceSong,
  type AiProvider,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@workspace/api-client-react";
import { PRESET_LABELS } from "@/lib/format";

interface Props {
  currentPreset: SuggestPreset;
  onPatch: (patch: ChatPatch) => void;
  jobId?: number;
}

interface Turn {
  role: "user" | "assistant";
  content: string;
  refs?: ReferenceSong[];
  patchSummary?: string;
  provider?: AiProvider;
}

const STARTERS = [
  "Afrobeats with heavy 808s, want it loud for the club",
  "Boom-bap hip-hop, warm and analog, vocal-forward",
  "Trap drill, dark mood, streaming-ready",
  "Amapiano, smooth low end, wide stereo",
];

function summarizePatch(patch: ChatPatch): string | undefined {
  const bits: string[] = [];
  if (patch.preset) bits.push(`preset: ${PRESET_LABELS[patch.preset] ?? patch.preset}`);
  const tweaks = Object.keys(patch.customParams).length;
  if (tweaks > 0) bits.push(`${tweaks} fine-tune${tweaks === 1 ? "" : "s"}`);
  if (patch.generateVariations === true) bits.push("3 AI variations");
  return bits.length > 0 ? bits.join(" · ") : undefined;
}

const PROVIDER_LABELS: Record<AiProvider, string> = {
  claude: "Claude Sonnet",
  openai: "GPT-4o",
};

export function PromptChatPanel({ currentPreset, onPatch, jobId }: Props) {
  const { toast } = useToast();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<AiProvider>("claude");
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [turns, loading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    if (trimmed.length < 2) return;
    setInput("");

    const nextTurns: Turn[] = [...turns, { role: "user", content: trimmed }];
    setTurns(nextTurns);
    setLoading(true);

    const messages: ChatMessage[] = nextTurns.map((t) => ({
      role: t.role,
      content: t.content,
    }));

    try {
      const r = await postChat(messages, provider, jobId);
      const summary = summarizePatch(r.patch);
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          content: r.reply,
          refs: r.referenceSongs,
          patchSummary: summary,
          provider: r.provider ?? provider,
        },
      ]);
      if (summary) {
        onPatch(r.patch);
        toast({
          title: r.done ? "Master ready to render" : "Settings updated",
          description: summary,
        });
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? (err.data as { error?: string } | null)?.error ?? "Chat failed."
          : err instanceof Error
            ? err.message
            : "Chat failed.";
      setTurns((prev) => prev.slice(0, -1));
      toast({ title: "Couldn't reach the AI", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setTurns([]);
    setInput("");
  };

  return (
    <div
      className="rounded-md border border-primary/30 bg-primary/5 p-4 space-y-3"
      data-testid="ai-chat-panel"
    >
      <div className="flex items-center gap-2 flex-wrap">
        <Wand2 size={16} className="text-primary" />
        <h3 className="text-sm font-semibold">Prompt-mix with the AI engineer</h3>
        <Badge
          variant="outline"
          className="text-[10px] uppercase tracking-wider px-1.5 font-mono border-primary/40 text-primary"
        >
          chat
        </Badge>
        {turns.length > 0 && (
          <button
            type="button"
            onClick={reset}
            className="ml-auto text-[10px] uppercase tracking-wider font-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            data-testid="btn-chat-reset"
          >
            <RotateCcw size={10} /> reset
          </button>
        )}
      </div>

      {/* AI model toggle */}
      <div className="flex items-center gap-1 rounded-md border border-border/40 bg-background/40 p-1 w-fit">
        {(["claude", "openai"] as AiProvider[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setProvider(p)}
            className={`text-[11px] font-mono px-2.5 py-1 rounded transition-all ${
              provider === p
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`btn-provider-${p}`}
          >
            {PROVIDER_LABELS[p]}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground -mt-1">
        Tell the AI how you want it to sound. Settings update live, and it&rsquo;ll suggest
        reference songs that match your vibe.
      </p>

      {turns.length === 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {STARTERS.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => send(ex)}
              disabled={loading}
              className="text-[11px] px-2 py-1 rounded-full bg-background/40 border border-border/50 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-50"
              data-testid={`btn-chat-starter-${ex.slice(0, 12)}`}
            >
              {ex}
            </button>
          ))}
        </div>
      ) : (
        <div
          ref={scrollerRef}
          className="max-h-72 overflow-y-auto space-y-3 rounded-md bg-background/40 p-3 border border-border/40"
          data-testid="chat-scroller"
        >
          {turns.map((t, i) => (
            <div
              key={i}
              className={t.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={
                  t.role === "user"
                    ? "max-w-[85%] rounded-md bg-primary/15 border border-primary/30 px-3 py-2 text-sm"
                    : "max-w-[90%] rounded-md bg-background/70 border border-border/50 px-3 py-2 text-sm space-y-2"
                }
                data-testid={`chat-msg-${t.role}-${i}`}
              >
                <div className="leading-relaxed whitespace-pre-wrap">{t.content}</div>
                {t.role === "assistant" && t.provider && (
                  <div className="text-[9px] uppercase tracking-wider font-mono text-muted-foreground/60">
                    via {PROVIDER_LABELS[t.provider]}
                  </div>
                )}
                {t.patchSummary && (
                  <div className="text-[10px] uppercase tracking-wider font-mono text-primary inline-flex items-center gap-1">
                    <Sparkles size={10} /> applied: {t.patchSummary}
                  </div>
                )}
                {t.refs && t.refs.length > 0 && (
                  <div className="pt-2 border-t border-border/40 space-y-1.5">
                    <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground inline-flex items-center gap-1">
                      <Music3 size={10} /> Reference tracks
                    </div>
                    {t.refs.map((r, j) => {
                      const q = encodeURIComponent(`${r.title} ${r.artist}`);
                      return (
                        <a
                          key={j}
                          href={`https://open.spotify.com/search/${q}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block rounded bg-background/60 border border-border/40 px-2 py-1.5 hover:border-primary/40 transition-colors group"
                          data-testid={`ref-song-${i}-${j}`}
                        >
                          <div className="text-xs font-semibold group-hover:text-primary transition-colors">
                            {r.title}{" "}
                            <span className="text-muted-foreground font-normal">— {r.artist}</span>
                          </div>
                          {r.why && (
                            <div className="text-[11px] text-muted-foreground mt-0.5">{r.why}</div>
                          )}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-md bg-background/70 border border-border/50 px-3 py-2 text-sm inline-flex items-center gap-2 text-muted-foreground">
                <Loader2 size={12} className="animate-spin" /> {PROVIDER_LABELS[provider]} thinking...
              </div>
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            turns.length === 0
              ? "Describe your track or pick a starter above..."
              : "Reply to the AI..."
          }
          maxLength={1000}
          disabled={loading}
          className="flex-1 rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm focus:outline-none focus:border-primary/60 disabled:opacity-50"
          data-testid="input-chat"
        />
        <Button
          type="submit"
          size="sm"
          disabled={loading || input.trim().length < 2}
          data-testid="btn-chat-send"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </Button>
      </form>

      {turns.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Current preset: <span className="font-mono text-foreground/80">{PRESET_LABELS[currentPreset] ?? currentPreset}</span>{" "}
          · settings auto-update each turn
        </p>
      )}
    </div>
  );
}
