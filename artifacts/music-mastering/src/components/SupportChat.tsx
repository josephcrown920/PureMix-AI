import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { MessageCircle, X, Send, Bot, User, ChevronDown, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Message {
  id: string;
  role: "bot" | "user";
  text: string;
  ts: number;
  streaming?: boolean;
}

const WELCOME: Message = {
  id: "welcome",
  role: "bot",
  text: "Hey! I'm Mixbot 🎚️ — your Puremix.ai studio assistant.\n\nAsk me about mastering tips, which preset to use for your genre, advanced controls, pricing, or anything else.",
  ts: Date.now(),
};

function ChatBubble({ msg }: { msg: Message }) {
  const isBot = msg.role === "bot";
  return (
    <div className={`flex gap-2 ${isBot ? "items-start" : "items-start flex-row-reverse"}`}>
      <div
        className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-xs mt-0.5 ${
          isBot
            ? "bg-primary/20 text-primary border border-primary/30"
            : "bg-muted text-muted-foreground border border-border"
        }`}
      >
        {isBot ? <Bot size={14} /> : <User size={14} />}
      </div>
      <div
        className={`max-w-[82%] px-3 py-2.5 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
          isBot
            ? "bg-card border border-border/60 text-foreground rounded-tl-none"
            : "bg-primary text-primary-foreground rounded-tr-none"
        }`}
      >
        {msg.text}
        {msg.streaming && (
          <span className="inline-block w-1.5 h-3.5 bg-current ml-0.5 animate-pulse rounded-sm" />
        )}
      </div>
    </div>
  );
}

const QUICK_PROMPTS = [
  "Best preset for Afrobeats?",
  "How do I get punchier kicks?",
  "What's the difference between presets?",
  "How does pricing work?",
];

export function SupportChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [unread, setUnread] = useState(1);
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduce = useReducedMotion();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", text: text.trim(), ts: Date.now() };
    const botId = `b-${Date.now()}`;
    const botPlaceholder: Message = { id: botId, role: "bot", text: "", ts: Date.now() + 1, streaming: true };

    setMessages((m) => [...m, userMsg, botPlaceholder]);
    setInput("");
    setLoading(true);

    abortRef.current = new AbortController();

    try {
      const history = [...messages, userMsg]
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role === "bot" ? "assistant" as const : "user" as const, content: m.text }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: abortRef.current.signal,
        credentials: "include",
      });

      if (!res.ok || !res.body) {
        throw new Error(res.statusText || "Request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const msg = JSON.parse(raw);
            if (msg.done) break;
            if (msg.error) throw new Error(msg.error);
            if (msg.content) {
              fullText += msg.content;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === botId ? { ...m, text: fullText, streaming: true } : m
                )
              );
            }
          } catch (parseErr) {
            // non-JSON line, skip
          }
        }
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === botId ? { ...m, streaming: false } : m))
      );
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") {
        setMessages((prev) => prev.filter((m) => m.id !== botId));
        return;
      }
      const fallback = "Sorry, I hit a snag. Try again or email support@puremix.ai.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botId ? { ...m, text: fallback, streaming: false } : m
        )
      );
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [messages, loading]);

  const send = () => sendMessage(input);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const showQuickPrompts = messages.length <= 1;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={reduce ? false : { opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="w-[350px] max-h-[560px] flex flex-col rounded-2xl border border-border/60 bg-background shadow-2xl shadow-black/40 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-card/80 border-b border-border/50 backdrop-blur-sm shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <Bot size={16} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold flex items-center gap-1.5">
                    Mixbot
                    <Sparkles size={10} className="text-primary" />
                  </p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
                    AI Studio Assistant
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
              >
                <ChevronDown size={16} />
              </Button>
            </div>

            {/* Messages */}
            <div
              ref={listRef}
              className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 scrollbar-thin min-h-0"
            >
              {messages.map((m) => (
                <ChatBubble key={m.id} msg={m} />
              ))}

              {/* Quick prompts after welcome only */}
              {showQuickPrompts && (
                <div className="flex flex-col gap-1.5 mt-1">
                  {QUICK_PROMPTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => sendMessage(q)}
                      className="text-left text-xs px-3 py-2 rounded-lg border border-border/50 bg-card/40 text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-primary/5 transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Input */}
            <div className="px-3 pb-3 pt-2 border-t border-border/50 bg-card/40 shrink-0">
              <div className="flex gap-2 items-center">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Ask about mastering, presets, pricing…"
                  disabled={loading}
                  className="flex-1 bg-background border border-border/60 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50 disabled:opacity-50"
                  aria-label="Chat input"
                />
                <Button
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={send}
                  disabled={!input.trim() || loading}
                  aria-label="Send message"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle button */}
      <motion.button
        onClick={() => setOpen((v) => !v)}
        className="relative h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-[0_0_24px_hsl(330_85%_65%/0.5)] hover:shadow-[0_0_36px_hsl(330_85%_65%/0.7)] flex items-center justify-center transition-shadow"
        whileHover={reduce ? undefined : { scale: 1.06 }}
        whileTap={reduce ? undefined : { scale: 0.94 }}
        transition={{ type: "spring", stiffness: 400, damping: 18 }}
        aria-label="Open support chat"
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="close"
              initial={reduce ? false : { rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={reduce ? undefined : { rotate: 90, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <X size={22} />
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={reduce ? false : { rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={reduce ? undefined : { rotate: -90, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <MessageCircle size={22} />
            </motion.span>
          )}
        </AnimatePresence>
        {!open && unread > 0 && (
          <motion.span
            initial={reduce ? false : { scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-background"
          >
            {unread}
          </motion.span>
        )}
      </motion.button>
    </div>
  );
}
