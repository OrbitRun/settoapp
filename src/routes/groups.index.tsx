import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";

import { BottomNav, Divider, Panel, Screen, TopBar } from "@/components/pari/AppShell";
import { EmptyState } from "@/components/pari/EmptyState";
import { GroupRow } from "@/components/pari/rows";
import { usePari } from "@/data/store";
import { useT } from "@/lib/i18n";
import { AuthGate } from "@/components/pari/AuthGate";

export const Route = createFileRoute("/groups/")({
  head: () => ({
    meta: [
      { title: "Groups — Setto" },
      {
        name: "description",
        content: "Households, holidays and everyday groups with a balance you can trust.",
      },
      { property: "og:title", content: "Groups — Setto" },
      {
        property: "og:description",
        content: "Households, holidays and everyday groups with a balance you can trust.",
      },
    ],
  }),
  component: () => (
    <AuthGate>
      <GroupsScreen />
    </AuthGate>
  ),
});

function GroupsScreen() {
  const pari = usePari();
  const t = useT();
  const groups = pari.data.groups.filter((group) => !group.archived_at);
  const archived = pari.data.groups.filter((group) => group.archived_at);
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  return (
    <>
      <Screen>
        <TopBar title={t("groups.title")} />

        <div className="space-y-6">
          <Panel>
            {groups.length === 0 ? (
              <EmptyState title={t("groups.none")} description={t("groups.noneHint")} />
            ) : (
              groups.map((group, index) => (
                <div key={group.id}>
                  {index > 0 ? <Divider /> : null}
                  <GroupRow
                    id={group.id}
                    name={group.name}
                    memberNames={pari
                      .groupPersonIds(group.id)
                      .map((personId) => pari.personName(personId))}
                    balanceMinor={pari.myGroupBalance(group.id)}
                  />
                </div>
              ))
            )}
          </Panel>

          {archived.length > 0 ? (
            <Panel title={t("groups.archivedTitle")}>
              {archived.map((group, index) => (
                <div key={group.id}>
                  {index > 0 ? <Divider /> : null}
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <span className="min-w-0 flex-1 truncate text-[15px] text-muted-foreground">
                      {group.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => void pari.setGroupArchived(group.id, false)}
                      className="shrink-0 rounded-full bg-surface-strong px-3.5 py-1.5 text-sm"
                    >
                      {t("groups.unarchive")}
                    </button>
                  </div>
                </div>
              ))}
            </Panel>
          ) : null}

          <Link
            to="/groups/new"
            className="flex items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Plus className="h-4 w-4" strokeWidth={1.8} />
            {t("groups.create")}
          </Link>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              const trimmed = code.trim();
              if (trimmed) navigate({ to: "/invite/$token", params: { token: trimmed } });
            }}
            className="flex items-center gap-2 rounded-2xl bg-surface px-4 py-2.5 shadow-soft"
          >
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder={t("invite.code")}
              maxLength={12}
              className="min-w-0 flex-1 bg-transparent text-[16px] tracking-[0.14em] outline-none placeholder:tracking-normal placeholder:text-muted-foreground/50"
            />
            <button
              type="submit"
              disabled={!code.trim()}
              className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
            >
              {t("invite.join")}
            </button>
          </form>
        </div>
      </Screen>
      <BottomNav />
    </>
  );
}
