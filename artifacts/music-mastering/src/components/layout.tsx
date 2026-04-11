import React from "react";
import { Link, useLocation } from "wouter";
import { RadioReceiver, Activity, History } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground dark selection:bg-primary/30">
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6 md:gap-10">
            <Link href="/" className="flex items-center space-x-2 transition-opacity hover:opacity-80" data-testid="link-home">
              <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-primary text-primary-foreground shadow-[0_0_15px_rgba(245,158,11,0.5)]">
                <RadioReceiver size={18} strokeWidth={2.5} />
              </div>
              <span className="hidden font-bold sm:inline-block font-mono tracking-tight text-xl">
                MasterAI<span className="text-primary">.</span>
              </span>
            </Link>
            <nav className="flex gap-6">
              <Link
                href="/"
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  location === "/" || location.startsWith("/jobs") ? "text-foreground" : "text-muted-foreground"
                }`}
                data-testid="link-nav-upload"
              >
                <div className="flex items-center gap-2">
                  <Activity size={16} />
                  <span>Studio</span>
                </div>
              </Link>
              <Link
                href="/history"
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  location === "/history" ? "text-foreground" : "text-muted-foreground"
                }`}
                data-testid="link-nav-history"
              >
                <div className="flex items-center gap-2">
                  <History size={16} />
                  <span>History</span>
                </div>
              </Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  );
}