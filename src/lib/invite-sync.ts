/**
 * Post-redemption synchronisation.
 *
 * The backend claim succeeds long before the client's cached account data
 * knows about the new group. Invalidating a query only marks it stale, so the
 * group screen could render from stale data and claim the group was gone.
 *
 * This helper is the single contract every invitation path uses:
 *   successful redeem -> awaited fresh fetch -> group present -> navigate.
 */

export type GroupSyncOutcome = "confirmed" | "unconfirmed";

export type ConfirmGroupOptions = {
  groupId: string;
  /** Fetches authoritative account data and writes it to the canonical cache. */
  fetchFresh: () => Promise<{ groups: { id: string }[] }>;
  /** Bounded: never loops forever. */
  attempts?: number;
  delayMs?: number;
  wait?: (ms: number) => Promise<void>;
};

const defaultWait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function confirmGroupAfterRedeem({
  groupId,
  fetchFresh,
  attempts = 3,
  delayMs = 400,
  wait = defaultWait,
}: ConfirmGroupOptions): Promise<GroupSyncOutcome> {
  const total = Math.max(1, attempts);
  for (let attempt = 0; attempt < total; attempt += 1) {
    if (attempt > 0) await wait(delayMs);
    try {
      const fresh = await fetchFresh();
      if (fresh.groups.some((group) => group.id === groupId)) return "confirmed";
    } catch {
      // A transient fetch failure is retried within the same bounded budget.
    }
  }
  return "unconfirmed";
}

/**
 * Guest migration owns navigation when the guest carried real expenses into
 * the new account — that product behaviour predates invitations and stays.
 */
export function invitationOwnsNavigation(guestExpenseCount: number): boolean {
  return guestExpenseCount === 0;
}
