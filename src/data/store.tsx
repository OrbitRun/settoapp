import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import {
  calculateBalances,
  calculateSettlementPlan,
  type Allocation,
  type Balance,
  type SettlementStep,
  type SplitMode,
} from "@/lib/split";
import { CURRENT_PERSON_ID, CURRENT_PROFILE_ID, createDemoData } from "./demo";
import { emptyDraft, itemTotalMinor, type DraftItem, type SplitDraft } from "./draft";
import type { ActivityEntry, Expense, PariData, Person } from "./types";

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const now = () => new Date().toISOString();

type AddExpenseInput = {
  groupId: string | null;
  title: string;
  merchant: string | null;
  paidByPersonId: string;
  totalMinor: number;
  allocations: Allocation[];
  source: "manual" | "receipt";
  items?: DraftItem[];
};

type CreateGroupInput = {
  name: string;
  personNames: string[];
  defaultSplitType: SplitMode;
  percentages?: Record<string, number>;
};

type PariContextValue = {
  data: PariData;
  currentPersonId: string;
  currentProfileName: string;
  personById: (id: string) => Person | undefined;
  personName: (id: string) => string;
  groupPersonIds: (groupId: string) => string[];
  groupExpenses: (groupId: string) => Expense[];
  expenseAllocations: (expenseId: string) => Allocation[];
  groupBalances: (groupId: string) => Balance[];
  myGroupBalance: (groupId: string) => number;
  netBalance: number;
  settlementPlan: (groupId: string) => SettlementStep[];
  recentExpenses: (limit?: number) => Expense[];
  activityFeed: () => ActivityEntry[];
  groupDefaultPercentages: (groupId: string) => Record<string, number> | null;
  addExpense: (input: AddExpenseInput) => Expense;
  createGroup: (input: CreateGroupInput) => string;
  markSettled: (groupId: string, step: SettlementStep) => void;
  draft: SplitDraft;
  setDraft: (updater: SplitDraft | ((prev: SplitDraft) => SplitDraft)) => void;
  resetDraft: () => void;
};

const PariContext = createContext<PariContextValue | null>(null);

export function PariProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PariData>(() => createDemoData());
  const [draft, setDraftState] = useState<SplitDraft>(() => emptyDraft(CURRENT_PERSON_ID));

  const value = useMemo<PariContextValue>(() => {
    const personById = (id: string) => data.people.find((p) => p.id === id);
    const personName = (id: string) => personById(id)?.name ?? "Ukendt";

    const groupPersonIds = (groupId: string) =>
      data.groupMembers.filter((m) => m.group_id === groupId).map((m) => m.person_id);

    const groupExpenses = (groupId: string) =>
      data.expenses
        .filter((e) => e.group_id === groupId)
        .sort((a, b) => b.expense_date.localeCompare(a.expense_date));

    const expenseAllocations = (expenseId: string): Allocation[] =>
      data.expenseSplits
        .filter((s) => s.expense_id === expenseId)
        .map((s) => ({
          personId: s.person_id,
          amountMinor: s.amount_minor,
          percentage: s.percentage ?? undefined,
          shares: s.shares ?? undefined,
        }));

    const balancesFor = (expenses: Expense[], groupId?: string) =>
      calculateBalances(
        expenses.map((expense) => ({
          paidByPersonId: expense.paid_by_person_id,
          totalMinor: expense.total_minor,
          allocations: expenseAllocations(expense.id),
        })),
        data.settlements
          .filter((s) => s.status === "settled" && (!groupId || s.group_id === groupId))
          .map((s) => ({
            fromPersonId: s.from_person_id,
            toPersonId: s.to_person_id,
            amountMinor: s.amount_minor,
          })),
      );

    const groupBalances = (groupId: string) => {
      const balances = balancesFor(groupExpenses(groupId), groupId);
      const ids = groupPersonIds(groupId);
      return ids.map(
        (personId) =>
          balances.find((b) => b.personId === personId) ?? { personId, netMinor: 0 },
      );
    };

    const myGroupBalance = (groupId: string) =>
      groupBalances(groupId).find((b) => b.personId === CURRENT_PERSON_ID)?.netMinor ?? 0;

    const netBalance = data.groups.reduce(
      (sum, group) => sum + myGroupBalance(group.id),
      0,
    );

    const settlementPlan = (groupId: string) =>
      calculateSettlementPlan(groupBalances(groupId).filter((b) => b.netMinor !== 0));

    const recentExpenses = (limit = 4) =>
      [...data.expenses]
        .sort((a, b) => b.expense_date.localeCompare(a.expense_date))
        .slice(0, limit);

    const activityFeed = () =>
      [...data.activity].sort((a, b) => b.created_at.localeCompare(a.created_at));

    const groupDefaultPercentages = (groupId: string) => {
      const group = data.groups.find((g) => g.id === groupId);
      if (!group || group.default_split_type !== "percentage") return null;
      const members = data.groupMembers.filter((m) => m.group_id === groupId);
      if (members.some((m) => m.default_percentage == null)) return null;
      return Object.fromEntries(
        members.map((m) => [m.person_id, m.default_percentage as number]),
      );
    };

    const addExpense = (input: AddExpenseInput): Expense => {
      const expense: Expense = {
        id: uid("exp"),
        group_id: input.groupId,
        created_by: CURRENT_PROFILE_ID,
        paid_by_person_id: input.paidByPersonId,
        title: input.title || input.merchant || "Udgift",
        merchant: input.merchant,
        expense_date: now(),
        currency: "DKK",
        total_minor: input.totalMinor,
        source_type: input.source,
        receipt_image_url: null,
        created_at: now(),
        updated_at: now(),
      };

      setData((prev) => ({
        ...prev,
        expenses: [expense, ...prev.expenses],
        expenseItems: [
          ...prev.expenseItems,
          ...(input.items ?? []).map((item) => ({
            id: uid("item"),
            expense_id: expense.id,
            name: item.name,
            quantity: item.quantity,
            unit_price_minor: item.unitPriceMinor,
            total_minor: itemTotalMinor(item),
            category: null,
            is_shared: item.isShared,
            created_at: now(),
          })),
        ],
        expenseSplits: [
          ...prev.expenseSplits,
          ...input.allocations.map((allocation) => ({
            id: uid("split"),
            expense_id: expense.id,
            person_id: allocation.personId,
            amount_minor: allocation.amountMinor,
            percentage: allocation.percentage ?? null,
            shares: allocation.shares ?? null,
          })),
        ],
        activity: [
          {
            id: uid("act"),
            group_id: input.groupId,
            actor_profile_id: CURRENT_PROFILE_ID,
            activity_type: "expense_added",
            entity_type: "expense",
            entity_id: expense.id,
            metadata: {
              actor: "Peter",
              title: expense.title,
              amount_minor: expense.total_minor,
            },
            created_at: now(),
          },
          ...prev.activity,
        ],
      }));

      return expense;
    };

    const createGroup = (input: CreateGroupInput) => {
      const groupId = uid("group");
      const newPeople: Person[] = [];
      const memberIds: string[] = [];

      for (const name of input.personNames) {
        const trimmed = name.trim();
        if (!trimmed) continue;
        const existing = data.people.find(
          (p) => p.name.toLowerCase() === trimmed.toLowerCase(),
        );
        if (existing) {
          memberIds.push(existing.id);
          continue;
        }
        const created: Person = {
          id: uid("person"),
          owner_user_id: CURRENT_PROFILE_ID,
          linked_profile_id: null,
          name: trimmed,
          avatar_url: null,
          created_at: now(),
        };
        newPeople.push(created);
        memberIds.push(created.id);
      }

      setData((prev) => ({
        ...prev,
        people: [...prev.people, ...newPeople],
        groups: [
          {
            id: groupId,
            name: input.name.trim() || "Ny gruppe",
            created_by: CURRENT_PROFILE_ID,
            default_split_type: input.defaultSplitType,
            currency: "DKK",
            created_at: now(),
            archived_at: null,
          },
          ...prev.groups,
        ],
        groupMembers: [
          ...prev.groupMembers,
          ...memberIds.map((personId, index) => ({
            id: uid("gm"),
            group_id: groupId,
            person_id: personId,
            role: (index === 0 ? "owner" : "member") as "owner" | "member",
            default_weight: null,
            default_percentage: input.percentages?.[personId] ?? null,
            joined_at: now(),
          })),
        ],
        activity: [
          {
            id: uid("act"),
            group_id: groupId,
            actor_profile_id: CURRENT_PROFILE_ID,
            activity_type: "group_created",
            entity_type: "group",
            entity_id: groupId,
            metadata: { actor: "Peter", title: input.name },
            created_at: now(),
          },
          ...prev.activity,
        ],
      }));

      return groupId;
    };

    const markSettled = (groupId: string, step: SettlementStep) => {
      setData((prev) => ({
        ...prev,
        settlements: [
          ...prev.settlements,
          {
            id: uid("settle"),
            group_id: groupId,
            from_person_id: step.fromPersonId,
            to_person_id: step.toPersonId,
            amount_minor: step.amountMinor,
            currency: "DKK",
            status: "settled",
            settled_at: now(),
            created_at: now(),
          },
        ],
        activity: [
          {
            id: uid("act"),
            group_id: groupId,
            actor_profile_id: CURRENT_PROFILE_ID,
            activity_type: "settlement_marked",
            entity_type: "settlement",
            entity_id: groupId,
            metadata: { actor: "Peter", amount_minor: step.amountMinor },
            created_at: now(),
          },
          ...prev.activity,
        ],
      }));
    };

    return {
      data,
      currentPersonId: CURRENT_PERSON_ID,
      currentProfileName: data.profiles[0]?.display_name ?? "Peter",
      personById,
      personName,
      groupPersonIds,
      groupExpenses,
      expenseAllocations,
      groupBalances,
      myGroupBalance,
      netBalance,
      settlementPlan,
      recentExpenses,
      activityFeed,
      groupDefaultPercentages,
      addExpense,
      createGroup,
      markSettled,
      draft,
      setDraft: setDraftState,
      resetDraft: () => setDraftState(emptyDraft(CURRENT_PERSON_ID)),
    };
  }, [data, draft]);

  return <PariContext.Provider value={value}>{children}</PariContext.Provider>;
}

export function usePari() {
  const context = useContext(PariContext);
  if (!context) throw new Error("usePari must be used inside <PariProvider>");
  return context;
}
