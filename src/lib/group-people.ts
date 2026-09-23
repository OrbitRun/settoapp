/**
 * Which people the group's "Personer" tab lists.
 *
 * The ledger (`groupBalances`) only keeps a removed member around while their
 * balance is still open — that is correct for money, but it hides a settled
 * former member from the People tab, so the owner can never reach their
 * "Invitér igen" action. The tab therefore lists every active member, every
 * removed member still carrying a balance, and every other former member at
 * zero.
 */

export type PeopleRow = { personId: string; netMinor: number; former: boolean };

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
 */
export function removalMode(args: {
  hasGroupHistory: boolean;
  linkedToAccount: boolean;
}): "deactivate" | "delete" {
  return args.hasGroupHistory || args.linkedToAccount ? "deactivate" : "delete";
}
