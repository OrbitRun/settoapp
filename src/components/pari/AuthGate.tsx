import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { usePari } from "@/data/store";
import { shouldRenderAuthedChildren } from "@/lib/auth-flow";

/**
 * Wraps an authenticated-only screen. Unauthenticated visitors are sent to the
 * guest welcome screen (the canonical unauthenticated root) — never to /auth.
 *
 * Children render only once the account data has loaded, so no screen ever
 * flashes empty placeholder values (no groups, 0 kr.) for a real account.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { authReady, isGuest, loading } = usePari();
  const navigate = useNavigate();

  useEffect(() => {
    if (authReady && isGuest) navigate({ to: "/", replace: true });
  }, [authReady, isGuest, navigate]);

  if (!shouldRenderAuthedChildren({ authReady, isGuest, loading })) {
    return <div className="min-h-svh bg-background" />;
  }
  return <>{children}</>;
}
