import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { removeReceiptObjects } from "@/lib/receipt-persistence.server";


/**
 * Account deletion orchestration.
 *
 * 1. Runs public.delete_my_account() as the authenticated caller (RLS + auth.uid()).
 * 2. Only when the cleanup reports ready_for_auth_delete does it load the
 *    service-role client and delete the auth user.
 *
 * The identity is taken exclusively from the verified bearer token; the client
 * never supplies a user id.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data, error } = await supabase.rpc("delete_my_account");

    if (error) {
      console.error("[account-delete] cleanup rpc failed", {
        userId,
        code: error.code,
        message: error.message,
      });
      return { success: false as const, stage: "cleanup" as const };
    }

    const summary = (data ?? {}) as Record<string, unknown>;
    if (summary["ready_for_auth_delete"] !== true) {
      console.error("[account-delete] cleanup did not report readiness", { userId });
      return { success: false as const, stage: "cleanup" as const };
    }

    // Private receipt images must never outlive the account. Rows cascade with
    // auth.users, but Storage objects do not — so they go first, and a failure
    // stops the deletion instead of leaving private images behind.
    const owned = await supabase.from("receipts").select("storage_path");
    if (owned.error) {
      console.error("[account-delete] receipt lookup failed", {
        userId,
        message: owned.error.message,
      });
      return { success: false as const, stage: "receipts" as const };
    }

    const cleanup = await removeReceiptObjects(
      supabase,
      (owned.data ?? []).map((row) => row.storage_path),
    );
    if (!cleanup.ok) {
      console.error("[account-delete] receipt objects remain", {
        userId,
        remaining: cleanup.remaining.length,
      });
      // delete_my_account is idempotent, so the user can safely retry.
      return { success: false as const, stage: "receipts" as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: adminError } = await supabaseAdmin.auth.admin.deleteUser(userId);


    if (adminError) {
      console.error("[account-delete] auth deletion failed", {
        userId,
        message: adminError.message,
      });
      return { success: false as const, stage: "auth" as const };
    }

    return { success: true as const };
  });
