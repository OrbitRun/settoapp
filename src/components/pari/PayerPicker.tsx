import { useState } from "react";
import { ChevronRight } from "lucide-react";

import { usePari } from "@/data/store";
import { useT } from "@/lib/i18n";
import { PersonChip } from "./PersonChip";

/**
 * Shared "Betalt af" selector used by both the manual expense flow and the
 * scanned receipt flow. Payer and participants stay independent concepts.
 */
export function PayerPicker({
  payerId,
  candidateIds,
  onChange,
}: {
  payerId: string;
  candidateIds: string[];
  onChange: (personId: string) => void;
}) {
  const pari = usePari();
  const t = useT();
  const [open, setOpen] = useState(false);

  const people = candidateIds.map((id) => ({ id, name: pari.personName(id) }));
  const valid = candidateIds.includes(payerId);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-2xl bg-surface px-4 py-4 text-left shadow-soft"
      >
        <span className="text-[15px] text-muted-foreground">{t("split.paidBy")}</span>
        <span className="flex items-center gap-2">
          <span className="text-[15px] font-medium tracking-tight">
            {!valid
              ? "—"
              : payerId === pari.currentPersonId
                ? t("common.you")
                : pari.personName(payerId)}
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.6} />
        </span>
      </button>

      {open ? (
        <div className="flex flex-wrap gap-2 px-1 pt-1">
          {people.map((person) => (
            <PersonChip
              key={person.id}
              name={person.name}
              selected={payerId === person.id}
              onClick={() => {
                onChange(person.id);
                setOpen(false);
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
