import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { MessageCircle, X, Send, Bot, User, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Message {
  id: string;
  role: "bot" | "user";
  text: string;
  ts: number;
}

const FAQS: { triggers: string[]; answer: string }[] = [
  {
    triggers: ["free", "trial", "free trial", "try"],
    answer:
      "Every new account gets 1 free trial master. You can preview the full mastered track at no cost — the download is gated behind a payment. No card is needed to preview.",
  },
  {
    triggers: ["format", "file type", "wav", "mp3", "flac", "upload"],
    answer:
      "We accept MP3, WAV, and FLAC files up to 100 MB. For the best mastering results, upload a WAV or FLAC file at 24-bit or higher.",
  },
  {
    triggers: ["how long", "time", "fast", "wait", "duration", "seconds", "minutes"],
    answer:
      "Most tracks complete in under 30 seconds. Longer files may take up to 2 minutes. You'll see a live progress bar on the job page.",
  },
  {
    triggers: ["preset", "streaming", "club", "vinyl", "broadcast", "platform"],
    answer:
      "We have 4 presets:\n• Streaming (-14 LUFS) — perfect for Spotify, Apple Music, Audiomack\n• Club — heavy limiting, maximum loudness for DJ sets\n• Warm Vinyl — analog warmth with preserved transients\n• Broadcast — strict EBU R128 compliance for TV/radio",
  },
  {
    triggers: ["download", "get my file", "receive", "email"],
    answer:
      "Once you unlock a master (via a $2 single, $10 24-hour pass, or $200 lifetime), the download button activates on the job page and we email the WAV directly to your account email.",
  },
  {
    triggers: ["price", "pricing", "cost", "pay", "payment", "$2", "$10", "$200"],
    answer:
      "Three options:\n• $2 — unlock a single track\n• $10 — 24-hour unlimited pass (best value)\n• $200 — lifetime, unlimited masters & downloads forever\n\nWe accept payments via Paystack (cards, bank transfer, USSD).",
  },
  {
    triggers: ["paystack", "card", "payment method", "pay with"],
    answer:
      "We use Paystack for secure payments. You can pay with any card (Visa, Mastercard), bank transfer, or USSD. All transactions are encrypted.",
  },
  {
    triggers: ["refund", "cancel", "return"],
    answer:
      "Because mastering is a digital service delivered instantly, we don't offer refunds once a job is processed. If you run into a technical issue, contact us and we'll sort it out.",
  },
  {
    triggers: ["afrobeats", "afropop", "amapiano", "hiphop", "hip-hop", "trap", "genre"],
    answer:
      "Puremix.ai is tuned specifically for African music genres — Afrobeats, Afropop, Amapiano, Afro-trap, hip-hop, and trap. Our models understand the punchy low-end, bright percussion, and dynamics these genres need.",
  },
  {
    triggers: ["contact", "help", "support", "human", "talk", "agent", "email us"],
    answer:
      "For billing or technical issues, email us at support@puremix.ai. We usually respond within a few hours.",
  },
  {
    triggers: ["hello", "hi", "hey", "start", "begin"],
    answer:
      "Hey! I'm the Puremix.ai support bot. Ask me anything about mastering, pricing, file formats, or how the service works.",
  },
];

const WELCOME: Message = {
  id: "welcome",
  role: "bot",
  text: "Hey! I'm the Puremix.ai support bot 🎚️\n\nAsk me about pricing, file formats, how mastering works, or anything else. I'm here to help.",
  ts: Date.now(),
};

const FALLBACK =
  "I'm not sure about that one. For account-specific issues email us at support@puremix.ai — we usually reply within a few hours.";

function findAnswer(query: string): string {
  const q = query.toLowerCase();
  for (const faq of FAQS) {
    if (faq.triggers.some((t) => q.includes(t))) return faq.answer;
  }
  return FALLBACK;
}

function ChatBubble({ msg }: { msg: Message }) {
  const isBot = msg.role === "bot";
  return (
    <div className={`flex gap-2 ${isBot ? "items-start" : "items-start flex-row-reverse"}`}>
      <div
        className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-xs ${
          isBot
            ? "bg-primary/20 text-primary border border-primary/30"
            : "bg-muted text-muted-foreground border border-border"
        }`}
      >
        {isBot ? <Bot size={14} /> : <User size={14} />}
      </div>
      <div
        className={`max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
          isBot
            ? "bg-card border border-border/60 text-foreground rounded-tl-none"
            : "bg-primary text-primary-foreground rounded-tr-none"
        }`}
      >
        {msg.text}
      </div>
    </div>
  );
}

export function SupportChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [unread, setUnread] = useState(1);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduce = useReducedMotion();

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

  const send = () => {
    const text = input.trim();
    if (!text) return;
    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", text, ts: Date.now() };
    const botMsg: Message = {
      id: `b-${Date.now()}`,
      role: "bot",
      text: findAnswer(text),
      ts: Date.now() + 1,
    };
    setMessages((m) => [...m, userMsg, botMsg]);
    setInput("");
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

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
            className="w-[340px] max-h-[520px] flex flex-col rounded-2xl border border-border/60 bg-background shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 bg-card/80 border-b border-border/50 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <Bot size={16} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Support</p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
                    Usually replies instantly
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

            <div
              ref={listRef}
              className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 scrollbar-thin"
              style={{ maxHeight: 360 }}
            >
              {messages.map((m) => (
                <ChatBubble key={m.id} msg={m} />
              ))}
            </div>

            <div className="px-3 pb-3 pt-2 border-t border-border/50 bg-card/40">
              <div className="flex gap-2 items-center">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Ask a question…"
                  className="flex-1 bg-background border border-border/60 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
                  aria-label="Chat input"
                />
                <Button
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={send}
                  disabled={!input.trim()}
                  aria-label="Send message"
                >
                  <Send size={14} />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setOpen((v) => !v)}
        className="relative h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-[0_0_24px_hsl(270_85%_68%/0.55)] hover:shadow-[0_0_36px_hsl(270_85%_68%/0.75)] flex items-center justify-center transition-shadow"
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
