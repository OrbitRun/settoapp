/**
 * Membership writes that must prove they landed.
 *
 * Under row-level security a blocked UPDATE/DELETE returns no error and simply
 * touches zero rows. Each write therefore asks for the affected row ids back
 * and treats "no rows" exactly like a database error.
 */

export type WriteOutcome = "ok" | "error" | "no-rows";

type Result = { data: { id: string }[] | null; error: unknown };

/** The narrow slice of the Supabase client these writes use. */
export type MembershipClient = {
  from(table: "group_members"): {
    update(values: { removed_at: string }): {
      eq(col: "group_id", v: string): {
        eq(col: "person_id", v: string): {
          is(col: "removed_at", v: null): { select(cols: "id"): PromiseLike<Result> };
        };
      };
    };
    delete(): {
      eq(col: "group_id", v: string): {
        eq(col: "person_id", v: string): { select(cols: "id"): PromiseLike<Result> };
      };
    };
  };
};

function outcome({ data, error }: Result): WriteOutcome {
  if (error) return "error";
  if (!data || data.length === 0) return "no-rows";
  return "ok";
}

/** Marks the person's active membership in the group as removed. */
export async function deactivateMembership(
  client: MembershipClient,
  groupId: string,
  personId: string,
  removedAt: string,
): Promise<WriteOutcome> {
  try {
    const res = await client
      .from("group_members")
      .update({ removed_at: removedAt })
      .eq("group_id", groupId)
      .eq("person_id", personId)
      .is("removed_at", null)
      .select("id");
    return outcome(res);
  } catch {
    return "error";
  }
}

/** Hard-deletes a confirmed unused placeholder's membership row. */
export async function deleteMembership(
  client: MembershipClient,
  groupId: string,
  personId: string,
): Promise<WriteOutcome> {
  try {
    const res = await client
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("person_id", personId)
      .select("id");
    return outcome(res);
  } catch {
    return "error";
  }
}

/**
 * After a confirmed write, a failed refresh must not be reported as a failed
 * save — the change is in the database and will show on the next load.
 */
export async function refreshQuietly(refresh: () => Promise<unknown>): Promise<boolean> {
  try {
    await refresh();
    return true;
  } catch {
    return false;
  }
}
