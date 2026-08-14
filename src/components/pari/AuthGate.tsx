import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { usePari } from "@/data/store";

/**
 * Wraps an authenticated-only screen. Unauthenticated visitors are sent to the
 * guest welcome screen (the canonical unauthenticated root) — never to /auth.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { authReady, isGuest } = usePari();
  const navigate = useNavigate();

  useEffect(() => {
    if (authReady && isGuest) navigate({ to: "/", replace: true });
  }, [authReady, isGuest, navigate]);

  if (!authReady || isGuest) return <div className="min-h-svh bg-background" />;
  return <>{children}</>;
}
