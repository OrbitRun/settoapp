import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { attachSupabaseAuth } from "./integrations/supabase/auth-attacher";
import { renderErrorPage } from "./lib/error-page";
import { settoServerFnFetch } from "./lib/native-serverfn";

/**
 * Origins allowed to call `/_serverFn/*` cross-origin. The web app is
 * same-origin (handled by the default CSRF check); these are exactly the two
 * origins a Capacitor iOS WebView can present. No wildcards.
 */
const NATIVE_ORIGINS = ["capacitor://localhost", "https://localhost"] as const;

const SERVER_FN_PREFIX = "/_serverFn/";

function isServerFnRequest(request: Request): boolean {
  try {
    return new URL(request.url).pathname.startsWith(SERVER_FN_PREFIX);
  } catch {
    return false;
  }
}

function nativeCorsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization, x-tsr-serverfn, accept",
    // The RPC client reads these to know how to deserialize the payload.
    // Cross-origin they are invisible unless explicitly exposed — without this
    // the native app receives `undefined` instead of the server fn result.
    "Access-Control-Expose-Headers": "content-type, x-tss-raw, x-tss-serialized",
    "Access-Control-Max-Age": "86400",

    Vary: "Origin",
  };
}

// Minimal CORS for server functions only, and only for the two native origins.
// Bearer tokens are sent in the Authorization header, so no credentials mode.
const nativeServerFnCorsMiddleware = createMiddleware().server(async ({ next, request }) => {
  const origin = request.headers.get("origin");
  const allowed =
    origin !== null &&
    (NATIVE_ORIGINS as readonly string[]).includes(origin) &&
    isServerFnRequest(request);

  if (!allowed) return next();

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: nativeCorsHeaders(origin) });
  }

  const result = await next();
  const response = (result as unknown as { response?: Response }).response;
  const target = response instanceof Response ? response : (result as unknown as Response);
  if (target instanceof Response) {
    for (const [key, value] of Object.entries(nativeCorsHeaders(origin))) {
      target.headers.set(key, value);
    }
  }
  return result;
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests. The native Capacitor origins are allowlisted
// exactly; every other cross-site caller is still rejected with 403.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
  origin: (value, ctx) => {
    if ((NATIVE_ORIGINS as readonly string[]).includes(value)) return true;
    try {
      return value === new URL(ctx.request.url).origin;
    } catch {
      return false;
    }
  },
  secFetchSite: (value, ctx) => {
    if (value === "same-origin" || value === "none") return true;
    // Capacitor WebViews mark the RPC as cross-site; accept only from the
    // exact native origins.
    const origin = ctx.request.headers.get("origin");
    return origin !== null && (NATIVE_ORIGINS as readonly string[]).includes(origin);
  },
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, nativeServerFnCorsMiddleware, csrfMiddleware],
  functionMiddleware: [attachSupabaseAuth],
  serverFns: { fetch: settoServerFnFetch },
}));
