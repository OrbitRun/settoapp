import { createFileRoute } from "@tanstack/react-router";

import { BottomNav, Panel, Screen, TopBar } from "@/components/pari/AppShell";
import { EmptyState } from "@/components/pari/EmptyState";
import { ActivityRow } from "@/components/pari/rows";
import { usePari } from "@/data/store";
import { dayGroupLabel } from "@/lib/dates";
import type { ActivityEntry } from "@/data/types";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity — PARI" },
      {
        name: "description",
        content: "A calm, transparent log of every expense, change and settlement.",
      },
      { property: "og:title", content: "Activity — PARI" },
      {
        property: "og:description",
        content: "A calm, transparent log of every expense, change and settlement.",
      },
    ],
  }),
  component: ActivityScreen,
});

const ACTIONS: Record<ActivityEntry["activity_type"], string> = {
  expense_added: "added",
  split_changed: "changed the split",
  settlement_marked: "marked a payment as settled",
  group_created: "created a group",
};

function ActivityScreen() {
  const pari = usePari();
  const feed = pari.activityFeed();

  const days = feed.reduce<Record<string, ActivityEntry[]>>((acc, entry) => {
    const key = dayGroupLabel(entry.created_at);
    (acc[key] ??= []).push(entry);
    return acc;
  }, {});

  return (
    <>
      <Screen>
        <TopBar title="Activity" />

        {feed.length === 0 ? (
          <EmptyState title="Nothing has happened yet" description="Your shared expenses will show up here." />
        ) : (
          <div className="space-y-8">
            {Object.entries(days).map(([day, entries]) => (
              <Panel key={day} title={day}>
                {entries.map((entry) => (
                  <ActivityRow
                    key={entry.id}
                    actor={String(entry.metadata['actor'] ?? "Someone")}
                    action={ACTIONS[entry.activity_type]}
                    subject={
                      entry.metadata['title']
                        ? String(entry.metadata['title'])
                        : entry.activity_type === "settlement_marked"
                          ? "Settled up"
                          : undefined
                    }
                    amountMinor={
                      typeof entry.metadata['amount_minor'] === "number"
                        ? entry.metadata['amount_minor']
                        : undefined
                    }
                    timeIso={entry.created_at}
                  />
                ))}
              </Panel>
            ))}
          </div>
        )}
      </Screen>
      <BottomNav />
    </>
  );
}
