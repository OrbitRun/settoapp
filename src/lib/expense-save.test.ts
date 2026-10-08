// MOCKED RPC: proves the client treats every failure as a failed save.
// Database atomicity is covered by supabase/tests/update_expense_with_splits.sql.
import { describe, expect, it } from "vitest";
import { ExpenseSaveError, saveExpenseEdit, type ExpenseRpcClient } from "./expense-save";

const client = (result: { data: unknown; error: { message: string } | null } | "throw") =>
  ({
    rpc: async () => {
      if (result === "throw") throw new Error("offline");
      return result;
    },
  }) as unknown as ExpenseRpcClient;

const input = {
  expenseId: "e1",
  patch: { total_minor: 1000 },
  splits: [
    { person_id: "a", amount_minor: 500, original_amount_minor: null, percentage: null, shares: null },
  ],
};

describe("saveExpenseEdit", () => {
  it("resolves only when the database confirms the expense id", async () => {
    await expect(saveExpenseEdit(client({ data: "e1", error: null }), input)).resolves.toBe(
      undefined,
    );
  });
  it("unauthorized edit is a failed save", async () => {
    await expect(
      saveExpenseEdit(client({ data: null, error: { message: "expense_update_denied" } }), input),
    ).rejects.toBeInstanceOf(ExpenseSaveError);
  });
  it("invalid replacement data is a failed save", async () => {
    await expect(
      saveExpenseEdit(client({ data: null, error: { message: "invalid_participant" } }), input),
    ).rejects.toThrow(/invalid_participant/);
  });
  it("network failure is a failed save", async () => {
    await expect(saveExpenseEdit(client("throw"), input)).rejects.toThrow(/network/);
  });
  it("unconfirmed response is a failed save", async () => {
    await expect(saveExpenseEdit(client({ data: null, error: null }), input)).rejects.toThrow(
      /unconfirmed/,
    );
  });
});
