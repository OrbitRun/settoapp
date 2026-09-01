/**
 * Native-only server-function transport.
 *
 * On the web the app is served from the same origin as its server functions, so
 * requests to `/_serverFn/...` resolve normally and this adapter is a pass-through.
 *
 * Inside the Capacitor shell the app boots from `capacitor://localhost`, where a
 * relative `/_serverFn/...` URL has no backend. Those — and only those — requests
 * are rewritten to the deployed Setto origin. Everything else (Supabase traffic,
 * asset requests, absolute URLs) is left untouched.
 */
import type { CustomFetch } from "@tanstack/react-start";

import { isNative } from "./native";

export const SETTO_REMOTE_ORIGIN = "https://setto.dk";

const SERVER_FN_PREFIX = "/_serverFn/";

function serverFnPathOf(input: RequestInfo | URL): string | undefined {
  try {
    const raw =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    // Resolve relative URLs against the current (Capacitor local) origin.
    const url = new URL(raw, typeof location !== "undefined" ? location.href : SETTO_REMOTE_ORIGIN);
    if (!url.pathname.startsWith(SERVER_FN_PREFIX)) return undefined;
    return `${url.pathname}${url.search}`;
  } catch {
    return undefined;
  }
}

/**
 * Registered via `createStart({ serverFns: { fetch } })`. Method, body, headers
 * (authorization, content-type, x-tsr-serverfn, accept, ...), abort signal and
 * every other request option are preserved by re-using the original Request /
 * init and only swapping the origin.
 */
export const settoServerFnFetch: CustomFetch = (input, init) => {
  if (!isNative()) return fetch(input as RequestInfo, init);

  const path = serverFnPathOf(input as RequestInfo | URL);
  if (!path) return fetch(input as RequestInfo, init);

  const target = `${SETTO_REMOTE_ORIGIN}${path}`;
  // Path only — never query values, bodies, headers or tokens.
  console.info(`[NATIVE_SERVERFN] rewriting to remote origin ${path.split("?")[0]}`);

  if (typeof Request !== "undefined" && input instanceof Request) {
    // Cloning through the Request constructor keeps method, headers, body,
    // signal, credentials mode and duplex semantics intact.
    return fetch(new Request(target, input), init);
  }

  return fetch(target, init);
};
