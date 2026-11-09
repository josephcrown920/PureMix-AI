import React, { useState } from "react";
import { Link } from "wouter";
import { formatLyricSheet, estimateSyllables, type LyricDraft, type LyricSection } from "@/lib/puremix-lyrics";
import { planPureMixRequest, type PureMixAgentPlan } from "@/lib/puremix-agent";

const sections: LyricSection[] = ["intro", "verse", "pre-chorus", "chorus", "bridge", "outro"];
export function LyricsAgentPage() {
  const [title, setTitle] = useState("Untitled song");
  const [bpm, setBpm] = useState("100");
  const [genre, setGenre] = useState("Afro-trap");
  const [section, setSection] = useState<LyricSection>("verse");
  const [lyrics, setLyrics] = useState("");
  const [instruction, setInstruction] = useState("");
  const [trackId, setTrackId] = useState("");
  const [plan, setPlan] = useState<PureMixAgentPlan | null>(null);
  const [error, setError] = useState("");
  function draft(): LyricDraft {
    return { title, bpm: bpm ? Number(bpm) : undefined, lines: lyrics.split("\n").map((text, i) => ({ id: String(i), text, section })) };
  }
  function exportText() {
    try {
      const text = formatLyricSheet(draft());
      const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = "puremix-lyrics.txt"; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); setError("");
    } catch (e) { setError(String(e)); }
  }
  function planAction() {
    try { setPlan(planPureMixRequest({ instruction, selectedTrackId: trackId.trim() || undefined })); setError(""); }
    catch (e) { setPlan(null); setError(String(e)); }
  }
  return <main className="mx-auto max-w-6xl p-5 space-y-6">
    <div className="flex items-center justify-between gap-3"><h1 className="text-3xl font-bold">PureMix Lyrics & Agent</h1><Link href="/studio" className="underline">Back to studio</Link></div>
    <p className="text-sm text-muted-foreground">Write and export original lyrics. Agent actions are previews until connected to verified audio tools.</p>
    <div className="grid gap-6 md:grid-cols-2">
      <section className="rounded-xl border p-5 space-y-4">
        <h2 className="text-xl font-semibold">Lyrics Writer</h2>
        <label className="block">Song title<input aria-label="Song title" className="w-full rounded border bg-background p-2" value={title} onChange={e => setTitle(e.target.value)}/></label>
        <div className="grid grid-cols-2 gap-3">
          <label>BPM<input aria-label="BPM" type="number" min="30" max="300" className="w-full rounded border bg-background p-2" value={bpm} onChange={e => setBpm(e.target.value)}/></label>
          <label>Genre<input aria-label="Genre" className="w-full rounded border bg-background p-2" value={genre} onChange={e => setGenre(e.target.value)}/></label>
        </div>
        <label>Section<select aria-label="Lyric section" className="w-full rounded border bg-background p-2" value={section} onChange={e => setSection(e.target.value as LyricSection)}>{sections.map(s => <option key={s}>{s}</option>)}</select></label>
        <label>Lyrics<textarea aria-label="Lyrics" className="w-full min-h-64 rounded border bg-background p-3" value={lyrics} onChange={e => setLyrics(e.target.value)} placeholder="Write your verse or hook..." /></label>
        <p className="text-sm text-muted-foreground">Estimated syllables: {estimateSyllables(lyrics)} · {genre}</p>
        <button type="button" onClick={exportText} className="rounded bg-primary px-4 py-2 text-primary-foreground">Export TXT</button>
      </section>
      <section className="rounded-xl border p-5 space-y-4">
        <h2 className="text-xl font-semibold">PureMix Agent</h2>
        <p className="text-sm text-muted-foreground">Plan music tasks. Paid processing and timeline editing require an authenticated tool executor.</p>
        <label>Selected track ID (for audio tasks)<input aria-label="Selected track ID" className="w-full rounded border bg-background p-2" value={trackId} onChange={e => setTrackId(e.target.value)}/></label>
        <label>Instruction<textarea aria-label="Agent instruction" className="w-full min-h-32 rounded border bg-background p-3" value={instruction} onChange={e => setInstruction(e.target.value)} placeholder="Isolate the vocals from this track" /></label>
        <button type="button" onClick={planAction} className="rounded bg-primary px-4 py-2 text-primary-foreground">Preview agent plan</button>
        {plan && <div role="status" className="rounded border p-3"><strong>Planned only — not executed</strong><pre className="mt-2 overflow-auto text-xs">{JSON.stringify(plan, null, 2)}</pre></div>}
        {error && <p role="alert" className="text-red-400">{error}</p>}
      </section>
    </div>
  </main>;
}
