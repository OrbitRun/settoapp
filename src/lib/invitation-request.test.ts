import { afterEach, describe, expect, it, vi } from "vitest";
import { InvitationRequestError, runInvitationRequest, type InvitationRequestState } from "./invitation-request";

describe("invitation sheet request lifecycle", () => {
  afterEach(() => vi.useRealTimers());

  it("ends loading with a confirmed permission failure", async () => {
    const states: InvitationRequestState<string>[] = [];
    await runInvitationRequest(async () => { throw new InvitationRequestError("permission"); }, (s) => states.push(s));
    expect(states).toEqual([{ status: "loading" }, { status: "failed", reason: "permission" }]);
  });

  it("ends loading after a network failure and a retry can return the invitation", async () => {
    const states: InvitationRequestState<string>[] = [];
    const request = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce("original-invitation");
    await runInvitationRequest<string>(request, (s) => states.push(s));
    expect(states.at(-1)).toEqual({ status: "failed", reason: "temporary" });
    await runInvitationRequest<string>(request, (s) => states.push(s));
    expect(states).toEqual([
      { status: "loading" }, { status: "failed", reason: "temporary" },
      { status: "loading" }, { status: "ready", invitation: "original-invitation" },
    ]);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("ends a stalled request after 15 seconds and aborts its network signal", async () => {
    vi.useFakeTimers();
    const states: InvitationRequestState<string>[] = [];
    let signal: AbortSignal | undefined;
    const pending = runInvitationRequest<string>((s) => {
      signal = s;
      return new Promise(() => {});
    }, (s) => states.push(s));
    await vi.advanceTimersByTimeAsync(15_000);
    await pending;
    expect(signal?.aborted).toBe(true);
    expect(states.at(-1)).toEqual({ status: "failed", reason: "temporary" });
  });

  it("treats an empty response as a retryable failure, not endless loading", async () => {
    const update = vi.fn();
    await runInvitationRequest(async () => null, update);
    expect(update).toHaveBeenLastCalledWith({ status: "failed", reason: "temporary" });
  });
});