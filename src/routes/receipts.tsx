import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Receipt as ReceiptIcon } from "lucide-react";

import { BottomNav, Panel, Screen } from "@/components/pari/AppShell";
import { FlowHeader } from "@/components/pari/FlowHeader";
import { EmptyState } from "@/components/pari/EmptyState";
import { AuthGate } from "@/components/pari/AuthGate";
import { ReceiptDetailSheet } from "@/components/pari/ReceiptDetailSheet";
import { listMyReceipts } from "@/lib/receipt.functions";
import { formatMinorIn } from "@/lib/money";
import { shortDate } from "@/lib/dates";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/receipts")({
  head: () => ({
    meta: [
      { title: "Receipts — PARI" },
      { name: "description", content: "Your private receipt archive in PARI." },
      { property: "og:title", content: "Receipts — PARI" },
      { property: "og:description", content: "Your private receipt archive in PARI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AuthGate>
      <ReceiptArchiveScreen />
    </AuthGate>
  ),
});

type ReceiptRow = Awaited<ReturnType<typeof listMyReceipts>>[number];

function ReceiptArchiveScreen() {
  const t = useT();
  const [rows, setRows] = useState<ReceiptRow[] | null>(null);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(() => {
    void listMyReceipts()
      .then((result) => setRows(result))
      .catch(() => setRows([]));
  }, []);

  useEffect(load, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!rows) return [];
    if (!needle) return rows;
    return rows.filter((row) => (row.merchantName ?? "").toLowerCase().includes(needle));
  }, [rows, query]);

  return (
    <>
      <Screen>
        <FlowHeader title={t("receipt.archiveTitle")} />

        <p className="px-1 pb-5 text-sm text-muted-foreground">{t("receipt.archivePrivacy")}</p>

        {rows && rows.length > 0 ? (
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("receipt.searchMerchant")}
            className="mb-6 h-14 w-full rounded-2xl bg-surface-strong px-4 text-[15px] outline-none ring-accent/40 focus:ring-2"
          />
        ) : null}

        {rows === null ? (
          <p className="px-1 text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={t("receipt.archiveEmptyTitle")}
            description={t("receipt.archiveEmptyBody")}
          />
        ) : (
          <Panel>
            <div className="space-y-1">
              {filtered.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setOpenId(row.id)}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left"
                >
                  <span className="h-14 w-12 shrink-0 overflow-hidden rounded-xl bg-surface-strong">
                    {row.thumbnailUrl ? (
                      <img
                        src={row.thumbnailUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center">
                        <ReceiptIcon
                          className="h-4 w-4 text-muted-foreground/60"
                          strokeWidth={1.6}
                        />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium tracking-tight">
                      {row.merchantName ?? t("receipt.unknownMerchant")}
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {[
                        row.purchaseDate ? shortDate(row.purchaseDate) : null,
                        row.linkedExpenseId ? t("receipt.linked") : t("receipt.notLinked"),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="tnum shrink-0 text-sm text-muted-foreground">
                    {row.totalMinor != null
                      ? formatMinorIn(row.totalMinor, row.currency ?? "DKK", { compact: false })
                      : ""}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" strokeWidth={1.6} />
                </button>
              ))}
            </div>
          </Panel>
        )}
      </Screen>
      <BottomNav />

      <ReceiptDetailSheet receiptId={openId} onClose={() => setOpenId(null)} onChanged={load} />
    </>
  );
}
