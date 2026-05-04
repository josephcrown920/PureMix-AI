import React from "react";
import { Link, useLocation } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  History as HistoryIcon,
  CreditCard,
  User as UserIcon,
  LogOut,
  Sparkles,
} from "lucide-react";
const puremixLogo = "/puremix-logo-new.png";
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
    trial: "bg-muted text-muted-foreground border-border",
    payg: "bg-primary/15 text-primary border-primary/30",
    day: "bg-primary/15 text-primary border-primary/30",
    lifetime: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  };
  const labels: Record<string, string> = {
    trial: "trial",
    payg: "pay-as-you-go",
    day: "24h pass",
    lifetime: "lifetime",
  };
  return (
    <Badge
      variant="outline"
      className={`${styles[plan] ?? styles.trial} text-[10px] uppercase tracking-wider px-2 font-mono`}
      data-testid="badge-plan"
    >
      {(plan === "lifetime" || plan === "day" || plan === "payg") && (
        <Sparkles size={10} className="mr-1" />
      )}
      {labels[plan] ?? plan}
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

interface NavLinkProps {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  testId: string;
}

function AnimatedNavLink({ href, active, icon, label, testId }: NavLinkProps) {
  const reduce = useReducedMotion();
  return (
    <Link
      href={href}
      className={`relative text-sm font-medium transition-colors hover:text-primary group ${
        active ? "text-foreground" : "text-muted-foreground"
      }`}
      data-testid={testId}
    >
      <span className="flex items-center gap-2 py-1">
        {icon}
        <span>{label}</span>
      </span>
      {active ? (
        <motion.span
          layoutId="nav-underline"
          className="absolute -bottom-1 left-0 right-0 h-[2px] rounded-full bg-primary shadow-[0_0_8px_hsl(270_85%_68%/0.7)]"
          transition={
            reduce
              ? { duration: 0 }
              : { type: "spring", stiffness: 400, damping: 32 }
          }
        />
      ) : (
        <span className="absolute -bottom-1 left-1/2 right-1/2 h-[2px] rounded-full bg-primary/0 group-hover:bg-primary/40 group-hover:left-2 group-hover:right-2 transition-all duration-300" />
      )}
    </Link>
  );
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const reduce = useReducedMotion();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground dark selection:bg-primary/30">
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6 md:gap-10">
            <Link href="/" className="flex items-center space-x-2.5 transition-opacity hover:opacity-80 group" data-testid="link-home">
              <motion.div
                className="relative h-9 w-9 rounded-full overflow-hidden ring-1 ring-primary/40 shadow-[0_0_18px_hsl(270_85%_68%/0.45)] group-hover:shadow-[0_0_24px_hsl(270_85%_68%/0.7)] transition-shadow"
                whileHover={reduce ? undefined : { rotate: -8, scale: 1.05 }}
                whileTap={reduce ? undefined : { scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 18 }}
              >
                <img src={puremixLogo} alt="Puremix.ai" className="h-full w-full object-cover scale-110" />
                <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-full" />
              </motion.div>
              <span className="hidden font-bold sm:inline-block font-mono tracking-tight text-xl">
                Puremix<span className="text-primary">.ai</span>
              </span>
            </Link>
            <Show when="signed-in">
              <nav className="flex gap-6">
                <AnimatedNavLink
                  href="/studio"
                  active={location === "/studio" || location.startsWith("/jobs")}
                  icon={<Activity size={16} />}
                  label="Studio"
                  testId="link-nav-upload"
                />
                <AnimatedNavLink
                  href="/history"
                  active={location === "/history"}
                  icon={<HistoryIcon size={16} />}
                  label="History"
                  testId="link-nav-history"
                />
                <AnimatedNavLink
                  href="/pricing"
                  active={location === "/pricing"}
                  icon={<CreditCard size={16} />}
                  label="Pricing"
                  testId="link-nav-pricing"
                />
              </nav>
            </Show>
            <Show when="signed-out">
              <nav className="flex gap-6">
                <AnimatedNavLink
                  href="/pricing"
                  active={location === "/pricing"}
                  icon={<CreditCard size={16} />}
                  label="Pricing"
                  testId="link-nav-pricing-out"
                />
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
