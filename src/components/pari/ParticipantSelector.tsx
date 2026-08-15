import { useT } from "@/lib/i18n";
import { PersonChip } from "./PersonChip";

export function ParticipantSelector({
  people,
  selected,
  onToggle,
  onSelectAll,
  label,
}: {
  people: { id: string; name: string }[];
  selected: string[];
  onToggle: (personId: string) => void;
  onSelectAll?: () => void;
  label?: string;
}) {
  const t = useT();
  const allSelected = people.length > 0 && selected.length === people.length;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-medium tracking-tight">
          {label ?? t("participants.title")}
        </h3>
        {onSelectAll ? (
          <button
            type="button"
            onClick={onSelectAll}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {allSelected ? t("common.deselectAll") : t("common.selectAll")}
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {people.map((person) => (
          <PersonChip
            key={person.id}
            name={person.name}
            selected={selected.includes(person.id)}
            onClick={() => onToggle(person.id)}
          />
        ))}
      </div>
    </section>
  );
}
