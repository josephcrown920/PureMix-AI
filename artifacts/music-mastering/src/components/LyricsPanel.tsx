import React, { useState } from "react";
import { FileText, Loader2, Copy, Download, Mic2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { postLyrics } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@workspace/api-client-react";

interface Props {
  jobId: number;
  /** Suggested filename (no extension) for downloaded lyrics .txt */
  baseFilename?: string;
}

export function LyricsPanel({ jobId, baseFilename = "lyrics" }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState<string | null>(null);

  const transcribe = async () => {
    setLoading(true);
    try {
      const r = await postLyrics(jobId);
      setText(r.text || "(no lyrics detected — track may be instrumental)");
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? (err.data as { error?: string } | null)?.error ?? "Transcription failed."
          : err instanceof Error
            ? err.message
            : "Transcription failed.";
      toast({ title: "Couldn't transcribe lyrics", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: "Lyrics copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const download = () => {
    if (!text) return;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseFilename}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-3"
      data-testid="lyrics-panel"
    >
      <div className="flex items-center gap-2">
        <Mic2 size={16} className="text-emerald-400" />
        <h3 className="text-sm font-semibold">Lyrics transcriber</h3>
        <Badge
          variant="outline"
          className="text-[10px] uppercase tracking-wider px-1.5 font-mono border-emerald-500/40 text-emerald-400"
        >
          included
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">
        Pull a clean lyrics sheet straight off the master — free with your purchase. Great for
        DSPs, sync briefs, and lyric videos.
      </p>

      {!text ? (
        <Button
          type="button"
          onClick={transcribe}
          disabled={loading}
          size="sm"
          className="w-full bg-emerald-500/90 hover:bg-emerald-500 text-emerald-950 font-semibold"
          data-testid="btn-transcribe-lyrics"
        >
          {loading ? (
            <>
              <Loader2 size={14} className="mr-2 animate-spin" /> Transcribing (~20s)...
            </>
          ) : (
            <>
              <FileText size={14} className="mr-2" /> Transcribe lyrics
            </>
          )}
        </Button>
      ) : (
        <>
          <div
            className="max-h-72 overflow-y-auto rounded-md bg-background/60 border border-border/40 p-3 text-sm whitespace-pre-wrap leading-relaxed font-mono"
            data-testid="lyrics-output"
          >
            {text}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copy}
              className="flex-1"
              data-testid="btn-copy-lyrics"
            >
              <Copy size={12} className="mr-1.5" /> Copy
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={download}
              className="flex-1"
              data-testid="btn-download-lyrics"
            >
              <Download size={12} className="mr-1.5" /> .txt
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={transcribe}
              disabled={loading}
              data-testid="btn-retranscribe"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : "Re-run"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
