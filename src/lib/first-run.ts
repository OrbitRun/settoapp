/**
 * First-run onboarding gate.
 *
 * A user is only "new" when the account itself was created moments ago —
 * inferred from `user.created_at` on the live session. Existing accounts can
 * never trip this, so shipping the feature never forces old users through
 * onboarding. Completion is remembered locally per user id; no schema change.
 */

import { supabase } from "@/integrations/supabase/client";
import { readPendingInvite } from "@/data/invitations";

/** How fresh an account must be to count as "just created". */
const NEW_ACCOUNT_WINDOW_MS = 5 * 60 * 1000;

const key = (userId: string) => `setto.firstRun.v1.${userId}`;

export function isFirstRunDone(userId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(key(userId)) === "done";
  } catch {
    return true;
  }
}

export function markFirstRunDone(userId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(userId), "done");
  } catch {
    /* storage unavailable — onboarding simply shows again next time */
  }
}

export type PostAuthDestination =
  | { to: "/invite/$token"; params: { token: string }; replace: true }
  | { to: "/getting-started"; replace: true }
  | { to: "/home"; replace: true };

/**
 * Where an authenticated user should land. A pending invitation always wins so
 * the invite flow is never interrupted or lost.
 */
export async function postAuthDestination(): Promise<PostAuthDestination> {
  const pending = readPendingInvite();
  if (pending) return { to: "/invite/$token", params: { token: pending }, replace: true };

  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return { to: "/home", replace: true };

  const createdAt = user.created_at ? Date.parse(user.created_at) : Number.NaN;
  const isNewAccount =
    Number.isFinite(createdAt) && Date.now() - createdAt < NEW_ACCOUNT_WINDOW_MS;

  if (isNewAccount && !isFirstRunDone(user.id)) return { to: "/getting-started", replace: true };
  return { to: "/home", replace: true };
}
