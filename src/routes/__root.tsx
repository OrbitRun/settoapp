import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { PariProvider, usePari } from "@/data/store";
import { I18nProvider } from "@/lib/i18n";
import { setMoneyDefaults } from "@/lib/money";
import { useHideAmounts } from "@/lib/privacy";
import { setDateLanguage } from "@/lib/dates";
import { Toaster } from "@/components/ui/sonner";
import { AccountSheet } from "@/components/pari/AccountSheet";
import { useScrollToTopOnNavigate } from "@/hooks/useScrollToTopOnNavigate";

function NotFoundComponent() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-6">
      <div className="max-w-sm text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Nothing here</h1>
        <p className="mt-2 text-sm text-muted-foreground">This page doesn't exist or has moved.</p>
        <Link
          to="/"
          className="mt-6 inline-flex h-12 items-center justify-center rounded-2xl bg-primary px-6 text-sm font-medium text-primary-foreground"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-6">
      <div className="max-w-sm text-center">
        <h1 className="text-xl font-semibold tracking-tight">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong. Try again or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-primary px-6 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-surface-strong px-6 text-sm font-medium"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Setto — Share anything. Settle easily." },
      {
        name: "description",
        content:
          "Setto is the calm way to split shared expenses — dinner, rent, groceries or a weekend away.",
      },
      { name: "theme-color", content: "#F7F6F2" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AppFrame({ children }: { children: ReactNode }) {
  const pari = usePari();
  useScrollToTopOnNavigate();
  // Privacy mode is read by the money formatter; subscribe here so every
  // rendered amount updates the instant the preference changes.
  useHideAmounts();

  setMoneyDefaults(pari.currency, pari.language === "da" ? "da-DK" : "en-GB");
  setDateLanguage(pari.language);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const prefersDark =
      typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = pari.appearance === "dark" || (pari.appearance === "system" && prefersDark);
    document.documentElement.classList.toggle("dark", dark);
  }, [pari.appearance]);

  return (
    <I18nProvider language={pari.language}>
      {children}
      <AccountSheet />
    </I18nProvider>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <PariProvider>
        <AppFrame>
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
        </AppFrame>
        <Toaster position="top-center" />
      </PariProvider>
    </QueryClientProvider>
  );
}
