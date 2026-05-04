import { useEffect, useRef } from "react";
import {
  Switch,
  Route,
  Router as WouterRouter,
  useLocation,
  Redirect,
} from "wouter";
import { AnimatePresence } from "framer-motion";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { shadcn } from "@clerk/themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { PageTransition } from "@/components/PageTransition";
import { UploadPage } from "@/pages/upload";
import { JobPage } from "@/pages/job";
import { HistoryPage } from "@/pages/history";
import { LandingPage } from "@/pages/landing";
import { PricingPage } from "@/pages/pricing";
import { AccountPage } from "@/pages/account";
import { BillingReturnPage } from "@/pages/billing-return";
import NotFound from "@/pages/not-found";
import { ApiAuthBridge } from "@/lib/api-client-config";
import { SupportChat } from "@/components/SupportChat";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in environment");
}

function stripBase(p: string): string {
  return basePath && p.startsWith(basePath)
    ? p.slice(basePath.length) || "/"
    : p;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl:
      typeof window !== "undefined"
        ? `${window.location.origin}${basePath}/logo.svg`
        : "/logo.svg",
  },
  variables: {
    colorPrimary: "hsl(270 85% 68%)",
    colorForeground: "hsl(270 15% 95%)",
    colorMutedForeground: "hsl(270 10% 60%)",
    colorDanger: "hsl(0 70% 55%)",
    colorBackground: "hsl(265 38% 10%)",
    colorInput: "hsl(265 30% 15%)",
    colorInputForeground: "hsl(270 15% 95%)",
    colorNeutral: "hsl(265 30% 25%)",
    fontFamily: "'Inter', sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full",
    cardBox:
      "bg-[hsl(265_38%_10%)] rounded-2xl w-[440px] max-w-full overflow-hidden border border-[hsl(265_30%_18%)] shadow-2xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[hsl(270_15%_95%)] font-bold",
    headerSubtitle: "text-[hsl(270_10%_60%)]",
    socialButtonsBlockButtonText: "text-[hsl(270_15%_95%)] font-medium",
    formFieldLabel: "text-[hsl(270_15%_95%)]",
    footerActionLink: "text-[hsl(270_85%_68%)] font-medium",
    footerActionText: "text-[hsl(270_10%_60%)]",
    dividerText: "text-[hsl(270_10%_60%)]",
    identityPreviewEditButton: "text-[hsl(270_85%_68%)]",
    formFieldSuccessText: "text-emerald-400",
    alertText: "text-[hsl(270_15%_95%)]",
    logoBox: "py-2",
    logoImage: "h-10 w-auto",
    socialButtonsBlockButton:
      "border border-[hsl(265_30%_22%)] hover:bg-[hsl(265_30%_15%)]",
    formButtonPrimary:
      "bg-[hsl(270_85%_68%)] hover:bg-[hsl(270_85%_72%)] text-[hsl(265_40%_7%)] font-bold",
    formFieldInput:
      "bg-[hsl(265_30%_15%)] border border-[hsl(265_30%_22%)] text-[hsl(270_15%_95%)]",
    footerAction: "pt-2",
    dividerLine: "bg-[hsl(265_30%_22%)]",
    alert: "border border-[hsl(265_30%_22%)] bg-[hsl(265_30%_13%)]",
    otpCodeFieldInput:
      "bg-[hsl(265_30%_15%)] border border-[hsl(265_30%_22%)] text-[hsl(270_15%_95%)]",
    formFieldRow: "gap-2",
    main: "gap-4",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        fallbackRedirectUrl={`${basePath}/studio`}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        fallbackRedirectUrl={`${basePath}/studio`}
      />
    </div>
  );
}

function HomeRoute() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/studio" />
      </Show>
      <Show when="signed-out">
        <Layout>
          <LandingPage />
        </Layout>
      </Show>
    </>
  );
}

function Protected({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <Layout>
          <Component />
        </Layout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prev = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsub = addListener(({ user }) => {
      const id = user?.id ?? null;
      if (prev.current !== undefined && prev.current !== id) qc.clear();
      prev.current = id;
    });
    return unsub;
  }, [addListener, qc]);
  return null;
}

function AnimatedRoutes() {
  const [location] = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <PageTransition key={location}>
        <Switch location={location}>
          <Route path="/" component={HomeRoute} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/pricing">
            <Layout><PricingPage /></Layout>
          </Route>
          <Route path="/billing/return" component={() => <Protected component={BillingReturnPage} />} />
          <Route path="/studio" component={() => <Protected component={UploadPage} />} />
          <Route path="/jobs/:id" component={() => <Protected component={JobPage} />} />
          <Route path="/history" component={() => <Protected component={HistoryPage} />} />
          <Route path="/account" component={() => <Protected component={AccountPage} />} />
          <Route>
            <Layout><NotFound /></Layout>
          </Route>
        </Switch>
      </PageTransition>
    </AnimatePresence>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: { title: "Welcome back", subtitle: "Sign in to continue mastering" },
        },
        signUp: {
          start: { title: "Create your account", subtitle: "Professional AI mastering — $2 per track" },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <ApiAuthBridge />
        <TooltipProvider>
          <AnimatedRoutes />
          <Toaster />
          <SupportChat />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}
