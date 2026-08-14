import { createFileRoute, Link } from "@tanstack/react-router";
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
      { title: "Groups — PARI" },
      {
        name: "description",
        content: "Households, holidays and everyday groups with a balance you can trust.",
      },
      { property: "og:title", content: "Groups — PARI" },
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

  return (
    <>
      <Screen>
        <TopBar title={t("groups.title")} />

        <div className="space-y-6">
          <Panel>
            {groups.length === 0 ? (
              <EmptyState
                title={t("groups.none")}
                description={t("groups.noneHint")}
              />
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

          <Link
            to="/groups/new"
            className="flex items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Plus className="h-4 w-4" strokeWidth={1.8} />
            {t("groups.create")}
          </Link>
        </div>
      </Screen>
      <BottomNav />
    </>
  );
}
