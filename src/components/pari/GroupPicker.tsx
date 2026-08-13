import { useState } from "react";
import { Check, ChevronRight } from "lucide-react";

import { usePari } from "@/data/store";
import { AvatarStack } from "./Avatar";
import { BottomSheet } from "./BottomSheet";

export function GroupPicker({
  groupId,
  onChange,
  allowNone = true,
  label = "Group",
}: {
  groupId: string | null;
  onChange: (groupId: string | null) => void;
  allowNone?: boolean;
  label?: string;
}) {
  const pari = usePari();
  const [open, setOpen] = useState(false);
  const group = pari.data.groups.find((g) => g.id === groupId);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between rounded-2xl bg-surface px-4 py-4 text-left shadow-soft"
      >
        <span className="text-[15px] text-muted-foreground">{label}</span>
        <span className="flex items-center gap-2">
          <span className="text-[15px] font-medium tracking-tight">
            {group ? group.name : "No group"}
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.6} />
        </span>
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Choose a group">
        <div className="space-y-1">
          {pari.data.groups.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                onChange(option.id);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-2xl px-4 py-3.5 text-left transition-colors hover:bg-surface-strong/70"
            >
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-medium tracking-tight">
                  {option.name}
                </span>
                <span className="mt-1.5 block">
                  <AvatarStack
                    names={pari.groupPersonIds(option.id).map((id) => pari.personName(id))}
                  />
                </span>
              </span>
              {groupId === option.id ? (
                <Check className="h-4 w-4 text-positive" strokeWidth={2} />
              ) : null}
            </button>
          ))}

          {allowNone ? (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="w-full rounded-2xl px-4 py-4 text-left text-[15px] text-muted-foreground transition-colors hover:bg-surface-strong/70"
            >
              No group — just these people
            </button>
          ) : null}
        </div>
      </BottomSheet>
    </>
  );
}
