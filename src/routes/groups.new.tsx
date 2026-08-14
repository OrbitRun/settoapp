import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, X } from "lucide-react";

import { Screen } from "@/components/pari/AppShell";
import { FlowHeader } from "@/components/pari/FlowHeader";
import { PrimaryButton } from "@/components/pari/Buttons";
import { Avatar } from "@/components/pari/Avatar";
import { usePari } from "@/data/store";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { SplitMode } from "@/lib/split";
import { AuthGate } from "@/components/pari/AuthGate";

type GroupSearch = { people?: string };

export const Route = createFileRoute("/groups/new")({
  validateSearch: (search: Record<string, unknown>): GroupSearch =>
    typeof search['people'] === "string" ? { people: search['people'] } : {},
  head: () => ({
    meta: [
      { title: "Create a group — PARI" },
      {
        name: "description",
        content: "Name it, add the people, done. No sign-ups needed for anyone else.",
      },
      { property: "og:title", content: "Create a group — PARI" },
      {
        property: "og:description",
        content: "Name it, add the people, done. No sign-ups needed for anyone else.",
      },
    ],
  }),
  component: () => (
    <AuthGate>
      <CreateGroupScreen />
    </AuthGate>
  ),
});

const OPTIONS: { value: SplitMode; labelKey: string }[] = [
  { value: "equal", labelKey: "split.equal" },
  { value: "percentage", labelKey: "split.percentage" },
  { value: "exact", labelKey: "groups.custom" },
];

function CreateGroupScreen() {
  const pari = usePari();
  const t = useT();
  const navigate = useNavigate();

  // Coming from a finished split: reuse exactly the people who shared it.
  const { people: carried } = Route.useSearch();
  const [name, setName] = useState("");
  // Only the other people — "you" is always a member and comes from the account.
  const [others, setOthers] = useState<string[]>(() =>
    (carried ?? "")
      .split("|")
      .map((value) => value.trim())
      .filter(Boolean)
      .filter((value) => value.toLowerCase() !== "mig" && value.toLowerCase() !== "me"),
  );
  const [newPerson, setNewPerson] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [defaultSplit, setDefaultSplit] = useState<SplitMode>("equal");

  const selfName = pari.currentProfileName;
  const people = others.filter((person) => person.toLowerCase() !== selfName.toLowerCase());

  const addPerson = () => {
    const trimmed = newPerson.trim();
    if (!trimmed) return;
    setOthers((prev) => [...prev, trimmed]);
    setNewPerson("");
  };

  const create = async () => {
    const groupId = await pari.createGroup({
      name,
      personNames: people,
      defaultSplitType: defaultSplit,
    });
    if (!groupId) return;
    navigate({ to: "/groups/$groupId", params: { groupId } });
  };


  return (
    <Screen>
      <FlowHeader title={t("groups.newGroup")} />

      <div className="space-y-9">
        <section className="space-y-3">
          <label htmlFor="group-name" className="block px-1 text-[13px] text-muted-foreground">
            {t("common.groupName")}
          </label>
          <input
            id="group-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("groups.namePlaceholder")}
            className="w-full rounded-2xl bg-surface px-5 py-4 text-[17px] tracking-tight shadow-soft outline-none placeholder:text-muted-foreground/60"
          />
        </section>

        <section className="space-y-3">
          <p className="px-1 text-[13px] text-muted-foreground">{t("groups.people")}</p>
          <div className="rounded-3xl bg-surface p-2 shadow-soft">
            <div className="flex items-center gap-3 px-3 py-2.5">
              <Avatar name={selfName} size="sm" />
              <span className="min-w-0 flex-1 truncate text-[15px]">{selfName}</span>
              <span className="text-xs text-muted-foreground">{t("common.you")}</span>
            </div>

            {people.map((person, index) => (
              <div key={`${person}-${index}`} className="flex items-center gap-3 px-3 py-2.5">
                <Avatar name={person} size="sm" />
                <span className="min-w-0 flex-1 truncate text-[15px]">{person}</span>
                <button
                  type="button"
                  aria-label={`${t("common.remove")} ${person}`}
                  onClick={() => setOthers((prev) => prev.filter((value) => value !== person))}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </div>
            ))}


            <div className="flex items-center gap-3 px-3 py-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-strong">
                <Plus className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
              </span>
              <input
                value={newPerson}
                onChange={(event) => setNewPerson(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addPerson();
                  }
                }}
                onBlur={addPerson}
                placeholder={t("groups.addPersonPlaceholder")}
                className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/70"
              />
            </div>
          </div>
          <p className="px-1 text-xs text-muted-foreground">
            {t("groups.peopleHint")}
          </p>
        </section>

        <section className="space-y-3">
          <button
            type="button"
            onClick={() => setShowAdvanced((prev) => !prev)}
            className="px-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("split.howToSplit")} ·{" "}
            {t(OPTIONS.find((o) => o.value === defaultSplit)?.labelKey ?? "split.equal")}
          </button>

          {showAdvanced ? (
            <div className="flex gap-2">
              {OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDefaultSplit(option.value)}
                  className={cn(
                    "flex-1 rounded-2xl py-3 text-sm font-medium transition-colors",
                    defaultSplit === option.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-strong text-muted-foreground",
                  )}
                >
                  {t(option.labelKey)}
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <PrimaryButton onClick={create} disabled={!name.trim() || people.length < 1}>
          {t("groups.create")}
        </PrimaryButton>
      </div>
    </Screen>
  );
}
