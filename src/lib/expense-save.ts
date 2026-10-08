/**
 * Saving an expense edit as ONE database transaction.
 *
 * The expense fields and its replacement splits are written by the
 * `update_expense_with_splits` database function, so a failure at any point
 * leaves the original expense and splits untouched. The client never deletes
 * and re-inserts splits itself.
 */

export type SplitRow = {
  person_id: string;
  amount_minor: number;
  original_amount_minor: number | null;
  percentage: number | null;
  shares: number | null;
};

export type ExpenseSaveInput = {
  expenseId: string;
  patch: Record<string, unknown>;
  /** null = leave the current splits as they are. */
  splits: SplitRow[] | null;
};

export class ExpenseSaveError extends Error {
  constructor(public readonly reason: string) {
    super(`expense-save-failed:${reason}`);
    this.name = "ExpenseSaveError";
  }
}

type RpcResult = { data: unknown; error: { message?: string } | null };

export type ExpenseRpcClient = {
  rpc(
    fn: "update_expense_with_splits",
    args: { _expense_id: string; _patch: never; _replace_splits: boolean; _splits: never },
  ): PromiseLike<RpcResult>;
};

/** Throws ExpenseSaveError unless the database confirmed the whole edit. */
export async function saveExpenseEdit(
  client: ExpenseRpcClient,
  input: ExpenseSaveInput,
): Promise<void> {
  let res: RpcResult;
  try {
    res = await client.rpc("update_expense_with_splits", {
      _expense_id: input.expenseId,
      _patch: input.patch as never,
      _replace_splits: input.splits !== null,
      _splits: (input.splits ?? []) as never,
    });
  } catch {
    throw new ExpenseSaveError("network");
  }
  if (res.error) throw new ExpenseSaveError(res.error.message ?? "database");
  if (res.data !== input.expenseId) throw new ExpenseSaveError("unconfirmed");
}
