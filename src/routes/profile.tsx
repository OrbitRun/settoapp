import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { BottomNav, Divider, Panel, Screen } from "@/components/pari/AppShell";
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

const SETTINGS = [
  { label: "Personal details", value: null },
  { label: "Default currency", value: "DKK" },
  { label: "Appearance", value: "System" },
  { label: "Help", value: null },
] as const;

function ProfileScreen() {
  const pari = usePari();

  return (
    <>
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

          <Panel title="Settings">
            {SETTINGS.map((item, index) => (
              <div key={item.label}>
                {index > 0 ? <Divider /> : null}
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-4 text-left text-[15px]"
                >
                  {item.label}
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    {item.value}
                    <ChevronRight className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.6} />
                  </span>
                </button>
              </div>
            ))}
            <Divider />
            <Link
              to="/onboarding"
              className="flex items-center justify-between px-4 py-4 text-[15px]"
            >
              How PARI works
              <ChevronRight className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.6} />
            </Link>
          </Panel>

          <Panel>
            <button
              type="button"
              className="w-full px-4 py-4 text-left text-[15px] text-negative"
            >
              Sign out
            </button>
          </Panel>
        </div>
      </Screen>
      <BottomNav />
    </>
  );
}
