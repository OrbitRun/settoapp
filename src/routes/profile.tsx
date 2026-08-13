import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { Divider, Panel, Screen } from "@/components/pari/AppShell";
import { FlowHeader } from "@/components/pari/FlowHeader";
import { Avatar } from "@/components/pari/Avatar";
import { MoneyAmount, balanceTone } from "@/components/pari/MoneyAmount";
import { usePari } from "@/data/store";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — PARI" },
      { name: "description", content: "Your details, people and preferences in PARI." },
      { property: "og:title", content: "Your profile — PARI" },
      { property: "og:description", content: "Your details, people and preferences in PARI." },
    ],
  }),
  component: ProfileScreen,
});

function ProfileScreen() {
  const pari = usePari();
  const people = pari.data.people.filter((p) => p.id !== pari.currentPersonId);

  return (
    <Screen>
      <FlowHeader title="Profile" />

      <div className="flex items-center gap-4 px-1 pb-8">
        <Avatar name={pari.currentProfileName} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-[22px] font-semibold tracking-[-0.03em]">
            {pari.currentProfileName}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Denmark · DKK</p>
        </div>
      </div>

      <div className="space-y-8">
        <Panel title="Overall">
          <div className="flex items-center justify-between px-4 py-4">
            <span className="text-[15px]">
              {pari.netBalance >= 0 ? "You're owed" : "You owe"}
            </span>
            <MoneyAmount
              minor={Math.abs(pari.netBalance)}
              tone={balanceTone(pari.netBalance)}
            />
          </div>
        </Panel>

        <Panel title="People">
          {people.map((person, index) => (
            <div key={person.id}>
              {index > 0 ? <Divider /> : null}
              <div className="flex items-center gap-3 px-4 py-3.5">
                <Avatar name={person.name} size="sm" />
                <span className="min-w-0 flex-1 truncate text-[15px]">{person.name}</span>
                <span className="text-xs text-muted-foreground">
                  {person.linked_profile_id ? "Connected" : "Not on PARI"}
                </span>
              </div>
            </div>
          ))}
        </Panel>

        <Panel title="About">
          <Link
            to="/onboarding"
            className="flex items-center justify-between px-4 py-4 text-[15px]"
          >
            How PARI works
            <ChevronRight className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.6} />
          </Link>
        </Panel>
      </div>
    </Screen>
  );
}
