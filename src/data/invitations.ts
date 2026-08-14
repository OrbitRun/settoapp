/**
 * Group invitations — one invitation object per group that can be shared as a
 * link, a QR code or a short join code. An invitation opened by a signed-out
 * person is remembered locally and applied right after they authenticate.
 */

import { supabase } from "@/integrations/supabase/client";

export type GroupInvitation = {
  id: string;
  group_id: string;
  token: string;
  join_code: string;
  expires_at: string;
  revoked_at: string | null;
  status?: string;
};

export type InvitationPreview = {
  groupName: string;
  inviterName: string;
  memberCount: number;
};

const PENDING_KEY = "pari.pendingInvite";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomToken(length: number, alphabet: string) {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
}

/**
 * The public invitation URL. `/invite/{token}` is the canonical path and the
 * future Universal Link target — it never contains an internal group id.
 */
export function invitationUrl(token: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/invite/${token}`;
}

/** Reuses the group's live invitation, or mints a new one. */
export async function ensureGroupInvitation(
  groupId: string,
  userId: string,
): Promise<GroupInvitation | null> {
  const { data: existing } = await supabase
    .from("group_invitations")
    .select("*")
    .eq("group_id", groupId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1);

  const live = (existing ?? [])[0] as GroupInvitation | undefined;
  if (live) return live;

  const { data, error } = await supabase
    .from("group_invitations")
    .insert({
      group_id: groupId,
      owner_user_id: userId,
      token: randomToken(24, "abcdefghijklmnopqrstuvwxyz0123456789"),
      join_code: randomToken(6, CODE_ALPHABET),
    })
    .select()
    .single();

  if (error) {
    console.error("[pari] ensureGroupInvitation", error);
    return null;
  }
  return data as unknown as GroupInvitation;
}

export async function revokeInvitation(id: string) {
  await supabase
    .from("group_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
}

export async function fetchInvitationPreview(code: string): Promise<InvitationPreview | null> {
  const { data, error } = await supabase.rpc("get_invitation_preview", { _code: code });
  if (error) {
    console.error("[pari] invitation preview", error);
    return null;
  }
  const row = (data ?? [])[0] as
    | { group_name: string; inviter_name: string; member_count: number }
    | undefined;
  if (!row) return null;
  return {
    groupName: row.group_name,
    inviterName: row.inviter_name,
    memberCount: row.member_count,
  };
}

/** Returns the joined group id. */
export async function acceptInvitation(code: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("accept_group_invitation", { _code: code });
  if (error) {
    console.error("[pari] accept invitation", error);
    return null;
  }
  return (data as string | null) ?? null;
}

export function savePendingInvite(code: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PENDING_KEY, code);
  } catch {
    /* storage unavailable */
  }
}

export function readPendingInvite(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

export function clearPendingInvite() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}
