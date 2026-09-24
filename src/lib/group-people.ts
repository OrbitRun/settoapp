/**
 * Which people the group's "Personer" tab lists, and how removing one is
 * recorded.
 *
 * The ledger (`groupBalances`) only keeps a removed member around while their
 * balance is still open — that is correct for money, but it hides a settled
 * former member from the People tab, so the owner can never reach their
 * "Invitér igen" action. The tab therefore lists every active member, every
 * removed member still carrying a balance, and every other former member at
 * zero.
 */

export type PeopleRow = { personId: string; netMinor: number; former: boolean };

/** The membership shape both the store and the People tab read. */
export type MembershipRow = {
  group_id: string;
  person_id: string;
  removed_at?: string | null;
};

export function activePersonIdsFor(members: MembershipRow[], groupId: string): string[] {
  return members.filter((m) => m.group_id === groupId && !m.removed_at).map((m) => m.person_id);
}

export function removedPersonIdsFor(members: MembershipRow[], groupId: string): string[] {
  return members
    .filter((m) => m.group_id === groupId && Boolean(m.removed_at))
    .map((m) => m.person_id);
}

export function groupPeopleRows(args: {
  /** Ledger rows: active members plus removed members with an open balance. */
  balances: { personId: string; netMinor: number }[];
  /** Every person with a removed membership in this group. */
  removedPersonIds: string[];
}): PeopleRow[] {
  const { balances, removedPersonIds } = args;
  const seen = new Set(balances.map((b) => b.personId));
  const rows: PeopleRow[] = balances.map((b) => ({
    personId: b.personId,
    netMinor: b.netMinor,
    former: removedPersonIds.includes(b.personId),
  }));
  for (const personId of removedPersonIds) {
    if (seen.has(personId)) continue;
    seen.add(personId);
    rows.push({ personId, netMinor: 0, former: true });
  }
  return rows;
}

/**
 * How removing a member is recorded.
 *
 * A person tied to a real account keeps their membership row (deactivated), so
 * a later invitation can reactivate exactly that membership and person id.
 * Only a throwaway placeholder with no history is hard-deleted.
 *
 * `linkedToAccount` is deliberately allowed to be unknown: if the client has
 * not loaded the person row, deleting would be irreversible, so an unknown
 * link is treated as "linked" and the membership is kept.
 */
export function removalMode(args: {
  hasGroupHistory: boolean;
  linkedToAccount: boolean | "unknown";
}): "deactivate" | "delete" {
  if (args.hasGroupHistory) return "deactivate";
  return args.linkedToAccount === false ? "delete" : "deactivate";
}
