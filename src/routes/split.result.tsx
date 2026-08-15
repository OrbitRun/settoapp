import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";

import { Divider, Panel, Screen } from "@/components/pari/AppShell";
import { PrimaryButton, SecondaryButton } from "@/components/pari/Buttons";
import { Avatar } from "@/components/pari/Avatar";
import { MoneyAmount } from "@/components/pari/MoneyAmount";
import { EmptyState } from "@/components/pari/EmptyState";
import { usePari } from "@/data/store";
import { useT } from "@/lib/i18n";
import { formatMinorIn } from "@/lib/money";
import { shortDate } from "@/lib/dates";

const searchSchema = z.object({ expenseId: z.string().optional() });

export const Route = createFileRoute("/split/result")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Split saved — PARI" },
      { name: "description", content: "Everyone's share, calculated to the øre." },
      { property: "og:title", content: "Split saved — PARI" },
      { property: "og:description", content: "Everyone's share, calculated to the øre." },
    ],
  }),
  component: ResultScreen,
});

function ResultScreen() {
  const { expenseId } = Route.useSearch();
  const pari = usePari();
  const t = useT();
  const navigate = useNavigate();

  const expense = pari.data.expenses.find((e) => e.id === expenseId);

  if (!expense) {
    return (
      <Screen>
        <EmptyState
          title={t("split.nothingToShow")}
          description={t("split.noLongerAvailable")}
          action={
            <Link to="/" className="text-sm underline underline-offset-4">
              {t("split.goHome")}
            </Link>
          }
        />
      </Screen>
    );
  }

  const foreign = Boolean(
    expense.original_currency && expense.original_currency !== expense.currency,
  );
  const originalCurrency = expense.original_currency ?? expense.currency;
  // The split itself lives in the original currency; balances use the converted one.
  const allocations = (foreign
    ? pari.expenseOriginalAllocations(expense.id)
    : pari.expenseAllocations(expense.id)
  ).sort((a, b) => b.amountMinor - a.amountMinor);

  const shareText = [
    `${expense.title} — ${formatMinorIn(expense.original_total_minor ?? expense.total_minor, originalCurrency, { compact: false })}`,
    "",
    ...allocations.map(
      (allocation) =>
        `${pari.personName(allocation.personId)}: ${formatMinorIn(allocation.amountMinor, originalCurrency, { compact: false })}`,
    ),
    "",
    "PARI",
  ].join("\n");

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const share = async () => {
    if (canShare) {
      try {
        await navigator.share({ title: expense.title, text: shareText });
        return;
      } catch {
        /* user dismissed — fall through to copy */
      }
    }
    await navigator.clipboard?.writeText(shareText);
    toast.success(t("split.copied"));
  };

  const saveInPari = () => {
    if (pari.isGuest) {
      pari.requireAccount("save_split");
      return;
    }
    pari.resetDraft();
    if (expense.group_id) {
      navigate({ to: "/groups/$groupId", params: { groupId: expense.group_id } });
      return;
    }
    const names = allocations
      .map((allocation) => pari.personName(allocation.personId))
      .filter((name) => name && name !== "—");
    navigate({ to: "/groups/new", search: { people: names.join("|") } });
  };

  const newSplit = () => {
    pari.resetDraft();
    navigate({ to: "/split/start" });
  };

  const finish = () => {
    pari.resetDraft();
    navigate({ to: pari.isGuest ? "/" : "/home" });
  };


  return (
    <Screen>
      <div className="animate-rise px-1 pb-5 pt-8 text-center">
        <p className="text-sm text-muted-foreground">{t("split.done")}</p>
        <h1 className="mt-1.5 text-[26px] font-semibold tracking-[-0.03em]">{expense.title}</h1>
        <p className="tnum mt-1 text-[34px] font-semibold tracking-[-0.035em]">
          {formatMinorIn(expense.original_total_minor ?? expense.total_minor, originalCurrency, {
            compact: false,
          })}
        </p>
        {foreign ? (
          <>
            <p className="tnum mt-1 text-[15px] text-muted-foreground">
              {t("currency.bookedAs", {
                amount: formatMinorIn(expense.total_minor, expense.currency, { compact: false }),
              })}
            </p>
            <p className="tnum mt-0.5 text-xs text-muted-foreground">
              {t("currency.rateLine", {
                base: originalCurrency,
                rate: Number(expense.exchange_rate ?? 1).toFixed(4).replace(".", ","),
                quote: expense.currency,
                date: expense.exchange_rate_date
                  ? shortDate(`${expense.exchange_rate_date}T12:00:00.000Z`)
                  : shortDate(expense.created_at),
              })}
            </p>
          </>
        ) : null}
      </div>

      <Panel>
        {allocations.map((allocation, index) => (
          <div key={allocation.personId}>
            {index > 0 ? <Divider /> : null}
            <div className="flex items-center gap-3 px-4 py-3">
              <Avatar name={pari.personName(allocation.personId)} size="sm" />
              <span className="min-w-0 flex-1 truncate text-[15px]">
                {pari.personName(allocation.personId)}
              </span>
              <span className="tnum text-[15px] font-medium">
                {formatMinorIn(allocation.amountMinor, originalCurrency, { compact: false })}
              </span>
            </div>
          </div>
        ))}
      </Panel>

      <div className="mt-6 space-y-2">
        <PrimaryButton onClick={() => void share()}>
          {canShare ? t("split.shareResult") : t("split.copyResult")}
        </PrimaryButton>

        {pari.isGuest ? (
          <div className="animate-rise mt-4 rounded-3xl bg-surface p-5 shadow-soft">
            <p className="text-[15px] font-medium tracking-tight">{t("convert.title")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("convert.body")}</p>
            <div className="mt-4">
              <SecondaryButton onClick={saveInPari}>{t("convert.cta")}</SecondaryButton>
            </div>
          </div>
        ) : (
          <SecondaryButton onClick={saveInPari}>{t("split.saveAsGroup")}</SecondaryButton>
        )}


        <SecondaryButton onClick={newSplit}>{t("split.newSplit")}</SecondaryButton>

        <button
          type="button"
          onClick={finish}
          className="mx-auto block py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {t("split.done")}
        </button>

      </div>
    </Screen>
  );
}
