import React, { useState } from "react";
import { Sparkles, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { fetchSuggestion, type SuggestPreset, type SuggestResponse } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@workspace/api-client-react";
import { PRESET_LABELS } from "@/lib/format";

interface Props {
  onApply: (s: SuggestResponse) => void;
  currentPreset: SuggestPreset;
}

const EXAMPLES = [
  "Afrobeats with heavy 808s, want it loud for the club",
  "Boom-bap hip-hop, warm and analog, vocal-forward",
  "Trap drill, dark mood, streaming-ready",
  "Amapiano, smooth low end, wide stereo",
];

export function AiSuggestPanel({ onApply, currentPreset }: Props) {
  const { toast } = useToast();
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SuggestResponse | null>(null);

  const handleAsk = async () => {
    if (description.trim().length < 4) {
      toast({
        title: "Tell us about your track",
        description: "A short description helps the AI suggest the right master.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const r = await fetchSuggestion(description.trim());
      setResult(r);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? (err.data as { error?: string } | null)?.error ?? "AI suggestion failed."
          : err instanceof Error
            ? err.message
            : "AI suggestion failed.";
      toast({ title: "Couldn't get a suggestion", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const apply = () => {
    if (!result) return;
    onApply(result);
    toast({
      title: "Applied",
      description: `Switched to "${PRESET_LABELS[result.preset] ?? result.preset}" preset.`,
    });
  };

  const tweakCount = result ? Object.keys(result.customParams).length : 0;

  return (
    <div
      className="rounded-md border border-primary/30 bg-primary/5 p-4 space-y-3"
      data-testid="ai-suggest-panel"
    >
      <div className="flex items-center gap-2">
        <Wand2 size={16} className="text-primary" />
        <h3 className="text-sm font-semibold">Ask the AI assistant</h3>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wider px-1.5 font-mono border-primary/40 text-primary">
          beta
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">
        Describe your track in plain English and we&rsquo;ll pick the right preset and tweaks.
      </p>

      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="e.g. Afrobeats with heavy 808s, want it loud for the club"
        rows={3}
        maxLength={1000}
        disabled={loading}
        className="resize-none bg-background/60 text-sm"
        data-testid="textarea-ai-description"
      />

      <div className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setDescription(ex)}
            disabled={loading}
            className="text-[11px] px-2 py-1 rounded-full bg-background/40 border border-border/50 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-50"
            data-testid={`btn-ai-example-${ex.slice(0, 12)}`}
          >
            {ex}
          </button>
        ))}
      </div>

      <Button
        type="button"
        onClick={handleAsk}
        disabled={loading || description.trim().length < 4}
        size="sm"
        className="w-full"
        data-testid="btn-ai-suggest"
      >
        {loading ? (
          <>
            <Loader2 size={14} className="mr-2 animate-spin" /> Thinking...
          </>
        ) : (
          <>
            <Sparkles size={14} className="mr-2" /> Suggest a master
          </>
        )}
      </Button>

      {result && (
        <div
          className="mt-3 rounded-md border border-primary/30 bg-background/50 p-3 space-y-2"
          data-testid="ai-suggest-result"
        >
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-mono">
              Recommendation
            </div>
            <Badge variant="outline" className="text-[10px] border-primary/40 text-primary font-mono">
              {PRESET_LABELS[result.preset] ?? result.preset}
            </Badge>
          </div>
          <p className="text-sm leading-relaxed" data-testid="text-ai-rationale">
            {result.rationale}
          </p>
          {tweakCount > 0 && (
            <div className="text-xs text-muted-foreground">
              {tweakCount} fine-tune{tweakCount === 1 ? "" : "s"} applied
              {result.generateVariations && " · 3 AI variations enabled"}
            </div>
          )}
          <Button
            type="button"
            onClick={apply}
            size="sm"
            variant={result.preset === currentPreset && tweakCount === 0 ? "outline" : "default"}
            className="w-full"
            data-testid="btn-ai-apply"
          >
            Apply suggestion
          </Button>
        </div>
      )}
    </div>
  );
}
