/**
 * Group invitations — one invitation object per group that can be shared as a
 * link, a QR code or a short join code. An invitation opened by a signed-out
 * person is remembered locally and applied right after they authenticate.
 */

import { supabase } from "@/integrations/supabase/client";

export type GroupInvitation = {
  id: string;
  group_id: string;
  person_id: string | null;
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
  personId: string | null;
  personName: string | null;
  personClaimed: boolean;
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
    .eq("status", "active")
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
    .update({ revoked_at: new Date().toISOString(), status: "revoked" })
    .eq("id", id);
}

export async function fetchInvitationPreview(code: string): Promise<InvitationPreview | null> {
  const { data, error } = await supabase.rpc("get_invitation_preview", { _code: code });
  if (error) {
    console.error("[pari] invitation preview", error);
    return null;
  }
  const row = (data ?? [])[0] as
    { group_name: string; inviter_name: string; member_count: number } | undefined;
  if (!row) return null;
  return {
    groupName: row.group_name,
    inviterName: row.inviter_name,
    memberCount: row.member_count,
  };
}

export type RedeemStatus =
  | "joined"
  | "already_member"
  | "expired"
  | "revoked"
  | "invalid"
  | "unauthenticated"
  | "error";

export type RedeemResult = { status: RedeemStatus; groupId: string | null };

/**
 * Idempotent invitation redemption. An existing membership is authoritative:
 * the backend returns `already_member` instead of creating a second row, so
 * repeated taps can never duplicate memberships, activity or ownership.
 */
export async function redeemInvitation(code: string): Promise<RedeemResult> {
  const { data, error } = await supabase.rpc("redeem_group_invitation", { _code: code });
  if (error) {
    console.error("[pari] redeem invitation", error);
    return { status: "error", groupId: null };
  }
  const row = (data ?? [])[0] as { status: string; group_id: string | null } | undefined;
  if (!row) return { status: "error", groupId: null };
  return { status: row.status as RedeemStatus, groupId: row.group_id ?? null };
}

/** Returns the joined group id, or null when the invitation could not be used. */
export async function acceptInvitation(code: string): Promise<string | null> {
  const result = await redeemInvitation(code);
  return result.groupId;
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
