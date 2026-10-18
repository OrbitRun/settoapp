export type InvitationFailure = "permission" | "temporary";

export class InvitationRequestError extends Error {
  constructor(public readonly kind: InvitationFailure) {
    super("Invitation request failed");
  }
}

/** Only a confirmed database privilege denial is an ownership error. */
export function invitationRequestError(error: unknown): InvitationRequestError {
  const denied = typeof error === "object" && error !== null &&
    "code" in error && error.code === "42501";
  return new InvitationRequestError(denied ? "permission" : "temporary");
}

export type InvitationRequestState<T> =
  | { status: "loading" }
  | { status: "ready"; invitation: T }
  | { status: "failed"; reason: InvitationFailure };

/** Shared by the sheet and tests; even a stalled request leaves loading. */
export async function runInvitationRequest<T>(
  request: (signal: AbortSignal) => Promise<T | null>,
  update: (state: InvitationRequestState<T>) => void,
): Promise<void> {
  update({ status: "loading" });
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const deadline = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        reject(new InvitationRequestError("temporary"));
        controller.abort();
      }, 15_000);
    });
    const invitation = await Promise.race([request(controller.signal), deadline]);
    if (!invitation) throw new InvitationRequestError("temporary");
    update({ status: "ready", invitation });
  } catch (error) {
    update({ status: "failed", reason: error instanceof InvitationRequestError ? error.kind : "temporary" });
  } finally {
    clearTimeout(timeout);
  }
}