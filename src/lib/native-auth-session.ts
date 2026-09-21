/**
 * JS face of the narrow native authentication transport
 * (`ios/App/App/SettoAuthSession.swift`).
 *
 * Swift owns only the `ASWebAuthenticationSession` UI; all OAuth semantics
 * (state, tokens, PKCE, Supabase session) stay in `src/lib/native-auth.ts`.
 */
import { registerPlugin } from "@capacitor/core";

export type NativeAuthSessionResult =
  | { status: "success"; callbackUrl: string }
  | { status: "cancelled" }
  | { status: "error" };

export interface SettoAuthSessionPlugin {
  /** Opens the provider URL in a native auth session and resolves its HTTPS callback. */
  startAuthentication(options: { url: string }): Promise<NativeAuthSessionResult>;
}

export const SettoAuthSession = registerPlugin<SettoAuthSessionPlugin>("SettoAuthSession");
