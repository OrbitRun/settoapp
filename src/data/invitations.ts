/**
 * Group invitations — a shareable link, QR code or short join code.
 *
 * Two kinds exist:
 * - person invitations (`person_id` set): the recipient claims an existing
 *   group person, keeping that person's id, history and balances. The member
 *   count never changes.
 * - group invitations (`person_id` null): the recipient becomes a new member.
 *
 * An invitation opened by a signed-out person is remembered locally and
 * applied right after they authenticate.
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
  /** Set only once the invitation was really shared/copied by the inviter. */
  sent_at?: string | null;
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

/**
 * Reuses the live invitation of that exact scope (group-wide, or one specific
 * person), or mints a new one. Person invitations never touch the person row.
 */
export async function ensureGroupInvitation(
  groupId: string,
  userId: string,
  personId?: string | null,
): Promise<GroupInvitation | null> {
  let query = supabase
    .from("group_invitations")
    .select("*")
    .eq("group_id", groupId)
    .eq("status", "active")
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString());

  query = personId ? query.eq("person_id", personId) : query.is("person_id", null);

  const { data: existing } = await query.order("created_at", { ascending: false }).limit(1);

  const live = (existing ?? [])[0] as GroupInvitation | undefined;
  if (live) return live;

  const { data, error } = await supabase
    .from("group_invitations")
    .insert({
      group_id: groupId,
      owner_user_id: userId,
      person_id: personId ?? null,
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

/**
 * Invitations that were actually shared — used to show "Invitation sendt".
 * Merely opening the invite sheet mints a token but never marks it sent.
 */
export async function fetchActiveInvitations(groupId: string): Promise<GroupInvitation[]> {
  const { data } = await supabase
    .from("group_invitations")
    .select("*")
    .eq("group_id", groupId)
    .eq("status", "active")
    .is("revoked_at", null)
    .not("sent_at", "is", null)
    .gt("expires_at", new Date().toISOString());
  return (data ?? []) as unknown as GroupInvitation[];
}

/** Records a completed share/copy. Called only after the action succeeded. */
export async function markInvitationSent(id: string) {
  const { error } = await supabase
    .from("group_invitations")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", id)
    .is("sent_at", null);
  if (error) console.error("[pari] markInvitationSent", error);
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
    | {
        group_name: string;
        inviter_name: string;
        member_count: number;
        person_id: string | null;
        person_name: string | null;
        person_claimed: boolean | null;
      }
    | undefined;
  if (!row) return null;
  return {
    groupName: row.group_name,
    inviterName: row.inviter_name,
    memberCount: row.member_count,
    personId: row.person_id ?? null,
    personName: row.person_name ?? null,
    personClaimed: Boolean(row.person_claimed),
  };
}

export type RedeemStatus =
  | "joined"
  | "claimed"
  | "already_member"
  | "person_taken"
  | "expired"
  | "revoked"
  | "invalid"
  | "unauthenticated"
  | "error";

export type RedeemResult = { status: RedeemStatus; groupId: string | null };

/**
 * Idempotent redemption. The claimed person is read from the invitation row
 * server-side — never from the client — so no one can point a claim at a
 * different group person. Person invitations link the existing person to the
 * caller's account; group invitations create a membership as before.
 */
export async function redeemInvitation(code: string): Promise<RedeemResult> {
  const { data, error } = await supabase.rpc("claim_group_invitation", { _code: code });
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
