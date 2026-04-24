import React from "react";
import { Link, useLocation } from "wouter";
import {
  RadioReceiver,
  Activity,
  History as HistoryIcon,
  CreditCard,
  User as UserIcon,
  LogOut,
  Sparkles,
} from "lucide-react";
import { Show, useClerk, useUser } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMe } from "@/lib/api";

interface LayoutProps {
  children: React.ReactNode;
}

function PlanBadge() {
  const { data: me } = useMe();
  if (!me) return null;
  const plan = me.plan;
  const styles: Record<string, string> = {
    free: "bg-muted text-muted-foreground border-border",
    pro: "bg-primary/15 text-primary border-primary/30",
    lifetime: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  };
  return (
    <Badge
      variant="outline"
      className={`${styles[plan] ?? styles.free} text-[10px] uppercase tracking-wider px-2 font-mono`}
      data-testid="badge-plan"
    >
      {plan === "pro" && <Sparkles size={10} className="mr-1" />}
      {plan}
    </Badge>
  );
}

function UserMenu() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const initials =
    (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "") ||
    user?.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() ||
    "U";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 px-2 gap-2 border-border/60"
          data-testid="btn-user-menu"
        >
          <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
            {initials}
          </div>
          <span className="hidden md:inline text-sm font-medium max-w-[140px] truncate">
            {user?.primaryEmailAddress?.emailAddress ?? "Account"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span className="truncate">
            {user?.primaryEmailAddress?.emailAddress}
          </span>
          <PlanBadge />
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setLocation("/account")} data-testid="menu-account">
          <UserIcon size={14} className="mr-2" /> Account
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocation("/pricing")} data-testid="menu-pricing">
          <CreditCard size={14} className="mr-2" /> Pricing
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut({ redirectUrl: window.location.origin + (import.meta.env.BASE_URL || "/") })}
          data-testid="menu-sign-out"
        >
          <LogOut size={14} className="mr-2" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const navLink = (active: boolean) =>
    `text-sm font-medium transition-colors hover:text-primary ${
      active ? "text-foreground" : "text-muted-foreground"
    }`;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground dark selection:bg-primary/30">
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6 md:gap-10">
            <Link href="/" className="flex items-center space-x-2 transition-opacity hover:opacity-80" data-testid="link-home">
              <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-primary text-primary-foreground shadow-[0_0_15px_hsl(195_90%_55%/0.5)]">
                <RadioReceiver size={18} strokeWidth={2.5} />
              </div>
              <span className="hidden font-bold sm:inline-block font-mono tracking-tight text-xl">
                Puremix<span className="text-primary">.ai</span>
              </span>
            </Link>
            <Show when="signed-in">
              <nav className="flex gap-6">
                <Link href="/studio" className={navLink(location === "/studio" || location.startsWith("/jobs"))} data-testid="link-nav-upload">
                  <span className="flex items-center gap-2"><Activity size={16} /><span>Studio</span></span>
                </Link>
                <Link href="/history" className={navLink(location === "/history")} data-testid="link-nav-history">
                  <span className="flex items-center gap-2"><HistoryIcon size={16} /><span>History</span></span>
                </Link>
                <Link href="/pricing" className={navLink(location === "/pricing")} data-testid="link-nav-pricing">
                  <span className="flex items-center gap-2"><CreditCard size={16} /><span>Pricing</span></span>
                </Link>
              </nav>
            </Show>
            <Show when="signed-out">
              <nav className="flex gap-6">
                <Link href="/pricing" className={navLink(location === "/pricing")} data-testid="link-nav-pricing-out">
                  <span className="flex items-center gap-2"><CreditCard size={16} /><span>Pricing</span></span>
                </Link>
              </nav>
            </Show>
          </div>
          <div className="flex items-center gap-3">
            <Show when="signed-out">
              <Button asChild variant="ghost" size="sm" data-testid="btn-sign-in">
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button asChild size="sm" data-testid="btn-sign-up">
                <Link href="/sign-up">Get started</Link>
              </Button>
            </Show>
            <Show when="signed-in">
              <UserMenu />
            </Show>
          </div>
        </div>
      </header>
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
