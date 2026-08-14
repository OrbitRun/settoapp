import { useState } from "react";
import { Check, Minus, Plus, X } from "lucide-react";

import { usePari } from "@/data/store";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";

/**
 * The single participant surface for every split flow.
 * Supports the fast path (a number of people) and the named path
 * (add / rename people) in one simple block — no group required.
 */
export function ParticipantPicker({
  selected,
  onChange,
  label,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
  label?: string;
}) {
  const pari = usePari();
  const t = useT();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const people = pari.data.people.map((person) => ({
    id: person.id,
    name: person.name,
    isSelf: person.is_self,
    avatarUrl: person.avatar_url,
  }));
  const allSelected = people.length > 0 && selected.length === people.length;

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const addPerson = async (personName: string) => {
    const created = await pari.addPerson(personName);
    if (!created) return null;
    if (!selected.includes(created.id)) onChange([...selected, created.id]);
    return created;
  };

  const setCount = async (next: number) => {
    const target = Math.max(1, Math.min(30, next));
    if (target === selected.length) return;

    if (target < selected.length) {
      onChange(selected.slice(0, target));
      return;
    }

    // Select already-known people first.
    let ids = [...selected];
    for (const person of people) {
      if (ids.length >= target) break;
      if (!ids.includes(person.id)) ids.push(person.id);
    }
    onChange(ids);

    if (ids.length >= target) return;

    // Signed-in users keep a real address book: never invent "Person N" rows —
    // open the add-person field so they can name the missing participant.
    if (!pari.isGuest) {
      setAdding(true);
      return;
    }

    while (ids.length < target) {
      const created = await pari.addPerson(t("participants.person", { index: ids.length + 1 }));
      if (!created) break;
      ids = [...ids, created.id];
      onChange(ids);
    }
  };


  const commitRename = async (id: string) => {
    const trimmed = editName.trim();
    setEditing(null);
    if (trimmed) await pari.renamePerson(id, trimmed);
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[15px] font-medium tracking-tight">
          {label ?? t("participants.title")}
        </h3>
        <button
          type="button"
          onClick={() => onChange(allSelected ? [] : people.map((p) => p.id))}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {allSelected ? t("common.deselectAll") : t("common.selectAll")}
        </button>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3 shadow-soft">
        <span className="text-[15px] text-muted-foreground">{t("participants.count")}</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="-"
            onClick={() => void setCount(selected.length - 1)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-strong active:scale-95"
          >
            <Minus className="h-4 w-4" strokeWidth={2} />
          </button>
          <span className="tnum w-6 text-center text-[17px] font-semibold">
            {selected.length}
          </span>
          <button
            type="button"
            aria-label="+"
            onClick={() => void setCount(selected.length + 1)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-strong active:scale-95"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        {people.map((person) => {
          const isSelected = selected.includes(person.id);
          return (
            <div
              key={person.id}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors",
                isSelected ? "bg-surface shadow-soft" : "bg-surface-strong/50",
              )}
            >
              <button
                type="button"
                onClick={() => toggle(person.id)}
                aria-label={person.name}
                className="shrink-0"
              >
                {isSelected ? (
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <Check className="h-4 w-4" strokeWidth={2.4} />
                  </span>
                ) : (
                  <Avatar
                    name={person.name}
                    size="sm"
                    imageUrl={person.avatarUrl}
                    className="h-9 w-9 opacity-50"
                  />
                )}
              </button>

              {editing === person.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  onBlur={() => void commitRename(person.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void commitRename(person.id);
                    if (event.key === "Escape") setEditing(null);
                  }}
                  className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(person.id);
                    setEditName(person.name);
                  }}
                  className="min-w-0 flex-1 truncate text-left text-[15px]"
                >
                  {person.name}
                </button>
              )}

              {!person.isSelf ? (
                <button
                  type="button"
                  aria-label={t("participants.remove")}
                  onClick={() => {
                    onChange(selected.filter((id) => id !== person.id));
                    void pari.deletePerson(person.id);
                  }}
                  className="shrink-0 rounded-full p-1.5 text-muted-foreground/60 transition-colors hover:text-foreground"
                >
                  <X className="h-4 w-4" strokeWidth={1.8} />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {adding ? (
        <div className="flex items-center gap-2 rounded-2xl bg-surface px-4 py-2.5 shadow-soft">
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("participants.namePlaceholder")}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              void addPerson(name);
              setName("");
              setAdding(false);
            }}
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/50"
          />
          <button
            type="button"
            onClick={() => {
              void addPerson(name);
              setName("");
              setAdding(false);
            }}
            className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            {t("participants.add")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex w-full items-center gap-2 rounded-2xl px-4 py-3 text-left text-[15px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          {t("participants.add")}
        </button>
      )}
    </section>
  );
}
