import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { Disc3, Layers3, SlidersHorizontal, UploadCloud, Wand2, PanelRightClose, PanelRightOpen, Music2 } from "lucide-react";

type Stage = "separation" | "mixing" | "mastering";
type Mode = "manual" | "auto";
const workspaces = [
  { id: "separation" as const, title: "Audio Separation", icon: Layers3 },
  { id: "mixing" as const, title: "Mixing", icon: SlidersHorizontal },
  { id: "mastering" as const, title: "Mastering", icon: Disc3 },
];

export function WorkstationPage() {
  const [, navigate] = useLocation();
  const [stage, setStage] = useState<Stage>("mastering");
  const [mode, setMode] = useState<Mode>("manual");
  const [agentOpen, setAgentOpen] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<string[]>(["Choose a workspace. The original PureMix mastering engine is available through the existing Mastering Upload workflow. AI mixing and source separation are not connected yet."]);
  const [tone, setTone] = useState("Neutral");
  const [dynamics, setDynamics] = useState("Balanced");
  const fileRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<string | null>(null);
  const choose = (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith("audio/") && !/\.(wav|mp3|flac|m4a|ogg)$/i.test(f.name)) return;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const next = URL.createObjectURL(f);
    urlRef.current = next; setUrl(next); setFile(f);
  };
  const ask = () => {
    if (!prompt.trim()) return;
    setMessages(m => [...m, "You: " + prompt.trim(), "Studio: This is a design-stage assistant. It cannot execute AI audio tools yet. For real mastering, use the connected PureMix mastering workflow."]);
    setPrompt("");
  };
  const glass = "rounded-[28px] border border-white/10 bg-white/[0.06] shadow-[0_20px_70px_rgba(0,0,0,.25)] backdrop-blur-2xl";
  return <main className="min-h-[80vh] rounded-[30px] bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,.25),transparent_55%),#0b0a15] p-4 text-white sm:p-6">
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="flex items-center gap-2 text-2xl font-bold"><Music2 className="text-violet-300"/> PureMix Workstation</h1><p className="text-sm text-white/50">Separate · Mix · Master · Manual or Auto</p></div>
      <div className="flex gap-2"><button className="rounded-xl border border-white/20 bg-white/10 p-3" onClick={() => setAgentOpen(v => !v)} aria-label="Toggle agent">{agentOpen?<PanelRightClose size={18}/>:<PanelRightOpen size={18}/>}</button><button className="flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-3 text-sm font-bold" onClick={() => fileRef.current?.click()}><UploadCloud size={17}/> Upload Song</button><input ref={fileRef} type="file" accept="audio/*,.wav,.mp3,.flac,.m4a" className="hidden" onChange={e => choose(e.target.files?.[0])}/></div>
    </header>
    <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)_auto]">
      <nav className={glass+" h-fit p-3"} aria-label="PureMix workspaces">{workspaces.map(({id,title,icon:Icon})=><button key={id} onClick={()=>setStage(id)} className={"mb-2 flex w-full items-center gap-3 rounded-2xl px-3 py-4 text-left text-sm "+(stage===id?"bg-violet-500/30":"hover:bg-white/10")}><Icon size={18}/>{title}</button>)}</nav>
      <div className="min-w-0 space-y-4">
        <section className={glass+" p-5"}><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{workspaces.find(w=>w.id===stage)?.title}</h2>{stage!=="separation"&&<div className="flex rounded-xl bg-black/30 p-1"><button onClick={()=>setMode("manual")} className={"rounded-lg px-4 py-2 text-sm "+(mode==="manual"?"bg-white/20":"")}>Manual</button><button onClick={()=>setMode("auto")} className={"rounded-lg px-4 py-2 text-sm "+(mode==="auto"?"bg-violet-500/40":"")}>Auto AI</button></div>}</div>
          {file?<div><div className="mb-3 rounded-2xl border border-white/10 bg-black/30 p-5"><p className="truncate font-semibold">{file.name}</p><p className="text-xs text-white/50">{(file.size/1024/1024).toFixed(1)} MB</p></div><audio controls src={url} className="w-full"/></div>:<button onClick={()=>fileRef.current?.click()} className="flex min-h-48 w-full flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-violet-300/30 bg-violet-500/5"><UploadCloud size={32} className="text-violet-300"/><strong>Upload a song to get started</strong><span className="text-xs text-white/50">WAV · MP3 · FLAC · M4A</span></button>}
        </section>
        <section className={glass+" p-5"}>
          {stage==="separation"?<><h3 className="mb-2 font-semibold">Stem Separation</h3><p className="mb-4 text-sm text-white/60">Vocals, drums, bass and other instruments will appear here when a stem separation model is connected. No fake stems are generated.</p><div className="grid gap-3 sm:grid-cols-2">{["Vocals","Drums","Bass","Other instruments"].map(x=><div key={x} className="rounded-2xl border border-white/10 bg-black/20 p-4">{x}<p className="mt-2 text-xs text-white/40">Not extracted</p></div>)}</div><button disabled className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-sm opacity-50">Separate Audio · Engine required</button></>:
          stage==="mixing"?<><h3 className="mb-2 font-semibold">{mode==="manual"?"Manual Mixing":"Automatic Mixing"}</h3><p className="mb-4 text-sm text-white/60">{mode==="manual"?"A multitrack mixing console will become active once separated stems or multitrack uploads are supported.":"LLM-directed auto mixing requires an agent connected to the separation and audio DSP services."}</p>{["Vocals","Drums","Bass","Instruments"].map(x=><div key={x} className="mb-2 flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-4"><span>{x}</span><span className="text-xs text-white/40">No stem loaded</span></div>)}</>:
          <><h3 className="mb-2 font-semibold">{mode==="manual"?"Manual Mastering":"Automatic Mastering"}</h3><p className="mb-4 text-sm text-white/60">{mode==="manual"?"Choose your sound, then open the original PureMix mastering workflow to submit and process the track.":"Use PureMix's existing mastering presets and backend. LLM-driven mastering is not yet connected."}</p><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-black/20 p-4"><p className="mb-3 text-sm text-white/60">Tone</p>{["Neutral","Warm","Bright"].map(x=><button key={x} onClick={()=>setTone(x)} className={"mr-2 mb-2 rounded-xl border px-3 py-2 text-xs "+(tone===x?"border-violet-400 bg-violet-500/30":"border-white/10")}>{x}</button>)}</div><div className="rounded-2xl bg-black/20 p-4"><p className="mb-3 text-sm text-white/60">Dynamics</p>{["Balanced","Punchy","Gentle"].map(x=><button key={x} onClick={()=>setDynamics(x)} className={"mr-2 mb-2 rounded-xl border px-3 py-2 text-xs "+(dynamics===x?"border-violet-400 bg-violet-500/30":"border-white/10")}>{x}</button>)}</div></div><p className="mt-3 text-xs text-white/45">These new controls are not yet wired to the processing API; use the existing mastering upload for real processing.</p><button onClick={()=>navigate("/studio")} className="mt-4 rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-black">Open Real Mastering Upload</button></>}
        </section>
      </div>
      {agentOpen&&<aside className={glass+" flex min-h-[480px] w-full flex-col lg:w-[300px]"}><div className="border-b border-white/10 p-4"><h3 className="flex items-center gap-2 font-semibold"><Wand2 size={17} className="text-violet-300"/> PureMix Agent</h3><p className="mt-1 text-xs text-white/50">Optional · AI connection pending</p></div><div className="max-h-[450px] flex-1 space-y-3 overflow-y-auto p-4">{messages.map((m,i)=><p key={i} className="rounded-2xl bg-violet-500/10 p-3 text-sm leading-6">{m}</p>)}</div><form onSubmit={e=>{e.preventDefault();ask();}} className="flex gap-2 border-t border-white/10 p-3"><input aria-label="Message PureMix agent" value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Describe your sound…" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 p-3 text-sm"/><button className="rounded-xl bg-violet-500 px-3" type="submit">Send</button></form></aside>}
    </div>
  </main>;
}
