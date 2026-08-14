import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import {
  calculateBalances,
  calculateSettlementPlan,
  type Allocation,
  type Balance,
  type SettlementStep,
  type SplitMode,
} from "@/lib/split";
import { detectLanguage, type Language } from "@/lib/i18n";
import { emptyDraft, itemTotalMinor, type DraftItem, type SplitDraft } from "./draft";
import {
  emptyPariData,
  type ActivityEntry,
  type ActivityType,
  type Appearance,
  type Expense,
  type ExpenseItem,
  type PariData,
  type Person,
  type Profile,
} from "./types";
import {
  clearGuestState,
  emptyGuestState,
  loadGuestState,
  makeGuestExpense,
  makeGuestItemId,
  makeGuestPerson,
  makeGuestSplitId,
  saveGuestState,
  withSelfPerson,
  type GuestState,
} from "./guest";

/** Why the app is asking a guest to create an account. */
export type AccountPromptReason =
  | "save_split"
  | "save_expense"
  | "create_group"
  | "balances"
  | "history"
  | "settle"
  | "collaborate";


const nowIso = () => new Date().toISOString();


export type AddExpenseInput = {
  groupId: string | null;
  title: string;
  merchant: string | null;
  paidByPersonId: string;
  totalMinor: number;
  allocations: Allocation[];
  source: "manual" | "receipt";
  items?: DraftItem[];
  expenseDate?: string;
};

type CreateGroupInput = {
  name: string;
  personNames: string[];
  defaultSplitType: SplitMode;
  percentages?: Record<string, number>;
};

type UpdateExpenseInput = {
  title?: string;
  merchant?: string | null;
  paidByPersonId?: string;
  totalMinor?: number;
  allocations?: Allocation[];
  expenseDate?: string;
};

type PariContextValue = {
  data: PariData;
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  language: Language;
  currency: string;
  appearance: Appearance;
  currentPersonId: string;
  currentProfileName: string;
  personById: (id: string) => Person | undefined;
  personName: (id: string) => string;
  groupPersonIds: (groupId: string) => string[];
  groupExpenses: (groupId: string) => Expense[];
  expenseById: (id: string) => Expense | undefined;
  expenseItems: (expenseId: string) => ExpenseItem[];
  expenseAllocations: (expenseId: string) => Allocation[];
  groupBalances: (groupId: string) => Balance[];
  myGroupBalance: (groupId: string) => number;
  netBalance: number;
  settlementPlan: (groupId: string) => SettlementStep[];
  recentExpenses: (limit?: number) => Expense[];
  activityFeed: () => ActivityEntry[];
  groupDefaultPercentages: (groupId: string) => Record<string, number> | null;
  addExpense: (input: AddExpenseInput) => Promise<Expense | null>;
  updateExpense: (id: string, input: UpdateExpenseInput) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  createGroup: (input: CreateGroupInput) => Promise<string | null>;
  markSettled: (groupId: string, step: SettlementStep) => Promise<void>;
  addPerson: (name: string) => Promise<Person | null>;
  renamePerson: (id: string, name: string) => Promise<void>;
  deletePerson: (id: string) => Promise<void>;
  updateProfile: (patch: Partial<Pick<Profile, "display_name" | "language" | "currency" | "appearance">>) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  draft: SplitDraft;
  setDraft: (updater: SplitDraft | ((prev: SplitDraft) => SplitDraft)) => void;
  resetDraft: () => void;
  /** True once the Supabase session check has resolved. */
  authReady: boolean;
  /** True when nobody is signed in — PARI runs as a local, device-only workspace. */
  isGuest: boolean;

  /** Opens the contextual "create an account" sheet instead of redirecting. */
  requireAccount: (reason: AccountPromptReason) => void;
  accountPrompt: AccountPromptReason | null;
  dismissAccountPrompt: () => void;
  /** True while a guest split is being moved into a freshly created account. */
  migratingGuestData: boolean;
  /** True when carrying a guest split into the new account failed. */
  guestMigrationFailed: boolean;

};


const PariContext = createContext<PariContextValue | null>(null);

async function fetchAll(userId: string): Promise<PariData> {
  const [
    profiles,
    people,
    groups,
    groupMembers,
    expenses,
    expenseItems,
    expenseSplits,
    itemSplits,
    settlements,
    activity,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId),
    supabase.from("people").select("*").order("created_at"),
    supabase.from("groups").select("*").order("created_at", { ascending: false }),
    supabase.from("group_members").select("*"),
    supabase.from("expenses").select("*").order("expense_date", { ascending: false }),
    supabase.from("expense_items").select("*").order("position"),
    supabase.from("expense_splits").select("*"),
    supabase.from("item_splits").select("*"),
    supabase.from("settlements").select("*"),
    supabase.from("activity").select("*").order("created_at", { ascending: false }).limit(200),
  ]);

  return {
    profiles: (profiles.data ?? []) as unknown as Profile[],
    people: (people.data ?? []) as unknown as Person[],
    groups: (groups.data ?? []) as unknown as PariData["groups"],
    groupMembers: (groupMembers.data ?? []) as unknown as PariData["groupMembers"],
    expenses: (expenses.data ?? []) as unknown as Expense[],
    expenseItems: (expenseItems.data ?? []) as unknown as ExpenseItem[],
    expenseSplits: (expenseSplits.data ?? []) as unknown as PariData["expenseSplits"],
    itemSplits: (itemSplits.data ?? []) as unknown as PariData["itemSplits"],
    settlements: (settlements.data ?? []) as unknown as PariData["settlements"],
    activity: (activity.data ?? []) as unknown as ActivityEntry[],
  };
}

/**
 * Moves a guest's local splits into a freshly authenticated account so nobody
 * ever has to scan or split the same receipt twice.
 * Returns the id of the newest saved expense.
 */
async function migrateGuestData(userId: string, state: GuestState): Promise<string | null> {
  const { data: existingPeople } = await supabase.from("people").select("*");
  const people = (existingPeople ?? []) as unknown as Person[];

  let selfPerson = people.find((p) => p.is_self) ?? null;
  if (!selfPerson) {
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();
    const { data: created } = await supabase
      .from("people")
      .insert({
        owner_user_id: userId,
        name: (profileRow?.display_name as string | undefined) || "PARI",
        is_self: true,
        linked_profile_id: userId,
      })
      .select()
      .single();
    selfPerson = (created ?? null) as unknown as Person | null;
  }

  const idMap = new Map<string, string>();
  for (const guestPerson of state.people) {
    if (guestPerson.is_self) {
      if (selfPerson) idMap.set(guestPerson.id, selfPerson.id);
      continue;
    }
    const match = people.find(
      (p) => p.name.toLowerCase() === guestPerson.name.toLowerCase(),
    );
    if (match) {
      idMap.set(guestPerson.id, match.id);
      continue;
    }
    const { data: created } = await supabase
      .from("people")
      .insert({ owner_user_id: userId, name: guestPerson.name })
      .select()
      .single();
    if (created) idMap.set(guestPerson.id, created.id as string);
  }

  let lastExpenseId: string | null = null;

  // Oldest first so the account timeline keeps the guest's order.
  const ordered = [...state.expenses].sort((a, b) =>
    a.expense_date.localeCompare(b.expense_date),
  );

  for (const guestExpense of ordered) {
    const payerId = idMap.get(guestExpense.paid_by_person_id) ?? selfPerson?.id;
    if (!payerId) continue;

    const { data: created, error } = await supabase
      .from("expenses")
      .insert({
        owner_user_id: userId,
        group_id: null,
        paid_by_person_id: payerId,
        title: guestExpense.title,
        merchant: guestExpense.merchant,
        total_minor: guestExpense.total_minor,
        source_type: guestExpense.source_type,
        currency: guestExpense.currency,
        expense_date: guestExpense.expense_date,
      })
      .select()
      .single();
    if (error || !created) throw error ?? new Error("Could not save the split");

    const expenseId = created.id as string;
    lastExpenseId = expenseId;

    const splits = state.expenseSplits
      .filter((split) => split.expense_id === guestExpense.id)
      .map((split) => ({
        owner_user_id: userId,
        expense_id: expenseId,
        person_id: idMap.get(split.person_id) ?? payerId,
        amount_minor: split.amount_minor,
        percentage: split.percentage,
        shares: split.shares,
      }));
    if (splits.length > 0) await supabase.from("expense_splits").insert(splits);

    const items = state.expenseItems
      .filter((item) => item.expense_id === guestExpense.id)
      .map((item, index) => ({
        owner_user_id: userId,
        expense_id: expenseId,
        name: item.name,
        quantity: item.quantity,
        unit_price_minor: item.unit_price_minor,
        total_minor: item.total_minor,
        is_shared: item.is_shared,
        position: index,
      }));
    if (items.length > 0) await supabase.from("expense_items").insert(items);

    await supabase.from("activity").insert({
      owner_user_id: userId,
      group_id: null,
      actor_person_id: payerId,
      activity_type: "expense_added",
      entity_type: "expense",
      entity_id: expenseId,
      metadata: { title: guestExpense.title, amount_minor: guestExpense.total_minor },
    });
  }

  return lastExpenseId;
}



export function PariProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [draft, setDraftState] = useState<SplitDraft>(() => emptyDraft(""));
  // Detected after mount only — the server can't know the device language.
  const [deviceLanguage, setDeviceLanguage] = useState<Language>("da");
  useEffect(() => setDeviceLanguage(detectLanguage()), []);

  const [guest, setGuestRaw] = useState<GuestState>(emptyGuestState);
  const [guestReady, setGuestReady] = useState(false);
  const [accountPrompt, setAccountPrompt] = useState<AccountPromptReason | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [migrationFailed, setMigrationFailed] = useState(false);
  const migratedRef = useRef(false);
  const navigate = useNavigate();


  const setGuest = useCallback((updater: (prev: GuestState) => GuestState) => {
    setGuestRaw((prev) => {
      const next = updater(prev);
      saveGuestState(next);
      return next;
    });
  }, []);

  // Hydrate the guest workspace on the client only (keeps SSR markup stable).
  useEffect(() => {
    const stored = withSelfPerson(loadGuestState());
    setGuestRaw(stored);
    saveGuestState(stored);
    if (stored.draft) setDraftState(stored.draft);
    setGuestReady(true);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") {
        return;
      }
      setSession(next ?? null);
      if (event === "SIGNED_OUT") queryClient.clear();
      else queryClient.invalidateQueries({ queryKey: ["pari"] });
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  const userId = session?.user?.id ?? null;
  const isGuest = authReady && !userId;

  const query = useQuery({
    queryKey: ["pari", userId],
    queryFn: () => fetchAll(userId as string),
    enabled: Boolean(userId),
    staleTime: 10_000,
  });

  const accountData = query.data ?? emptyPariData;

  const data = useMemo<PariData>(() => {
    if (!isGuest) return accountData;
    return {
      ...emptyPariData,
      people: guest.people,
      expenses: guest.expenses,
      expenseItems: guest.expenseItems,
      expenseSplits: guest.expenseSplits,
    };
  }, [isGuest, accountData, guest]);

  const profile = accountData.profiles[0] ?? null;
  const selfPerson = data.people.find((p) => p.is_self) ?? data.people[0];
  const currentPersonId = selfPerson?.id ?? "";

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["pari"] });
  }, [queryClient]);

  // Keep the draft payer in sync once the real person id is known.
  useEffect(() => {
    if (!currentPersonId) return;
    setDraftState((prev) =>
      prev.paidByPersonId && data.people.some((p) => p.id === prev.paidByPersonId)
        ? prev
        : { ...prev, paidByPersonId: currentPersonId, participants: [currentPersonId] },
    );
  }, [currentPersonId, data.people]);

  // Persist the guest's split in progress so a reload or OAuth redirect keeps it.
  useEffect(() => {
    if (!isGuest || !guestReady) return;
    setGuest((prev) => (prev.draft === draft ? prev : { ...prev, draft }));
  }, [draft, isGuest, guestReady, setGuest]);

  // A guest just signed in or created an account: carry their split across.
  useEffect(() => {
    if (!userId || !guestReady || migratedRef.current) return;
    migratedRef.current = true;
    const stored = loadGuestState();
    const resetGuest = () => {
      clearGuestState();
      setGuestRaw(withSelfPerson(emptyGuestState));
      setDraftState(emptyDraft(""));
    };
    if (stored.expenses.length === 0) {
      resetGuest();
      return;
    }
    setMigrating(true);
    void migrateGuestData(userId, stored)
      .then(async (expenseId) => {
        resetGuest();
        await queryClient.invalidateQueries({ queryKey: ["pari"] });
        if (expenseId) {
          navigate({ to: "/split/result", search: { expenseId } });
        }
      })
      .catch((error) => {
        console.error("[pari] guest migration", error);
        migratedRef.current = false;
        setMigrationFailed(true);
      })
      .finally(() => setMigrating(false));
  }, [userId, guestReady, queryClient, navigate]);




  const value = useMemo<PariContextValue>(() => {
    const personById = (id: string) => data.people.find((p) => p.id === id);
    const personName = (id: string) => personById(id)?.name ?? "—";

    const groupPersonIds = (groupId: string) =>
      data.groupMembers.filter((m) => m.group_id === groupId).map((m) => m.person_id);

    const groupExpenses = (groupId: string) =>
      data.expenses
        .filter((e) => e.group_id === groupId)
        .sort((a, b) => b.expense_date.localeCompare(a.expense_date));

    const expenseById = (id: string) => data.expenses.find((e) => e.id === id);

    const expenseItems = (expenseId: string) =>
      data.expenseItems.filter((i) => i.expense_id === expenseId);

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
      return groupPersonIds(groupId).map(
        (personId) => balances.find((b) => b.personId === personId) ?? { personId, netMinor: 0 },
      );
    };

    const myGroupBalance = (groupId: string) =>
      groupBalances(groupId).find((b) => b.personId === currentPersonId)?.netMinor ?? 0;

    const netBalance = data.groups.reduce((sum, group) => sum + myGroupBalance(group.id), 0);

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
      if (members.length === 0 || members.some((m) => m.default_percentage == null)) return null;
      return Object.fromEntries(
        members.map((m) => [m.person_id, Number(m.default_percentage)]),
      );
    };

    const logActivity = async (
      type: ActivityType,
      entityType: "expense" | "settlement" | "group",
      entityId: string | null,
      groupId: string | null,
      metadata: Record<string, string | number>,
    ) => {
      if (!userId) return;
      await supabase.from("activity").insert({
        owner_user_id: userId,
        group_id: groupId,
        actor_person_id: currentPersonId || null,
        activity_type: type,
        entity_type: entityType,
        entity_id: entityId,
        metadata,
      });
    };

    const addExpense = async (input: AddExpenseInput): Promise<Expense | null> => {
      if (!userId) return null;
      const title = input.title || input.merchant || "Udgift";
      const { data: created, error } = await supabase
        .from("expenses")
        .insert({
          owner_user_id: userId,
          group_id: input.groupId,
          paid_by_person_id: input.paidByPersonId,
          title,
          merchant: input.merchant,
          total_minor: input.totalMinor,
          source_type: input.source,
          currency: profile?.currency ?? "DKK",
          expense_date: input.expenseDate ?? nowIso(),
        })
        .select()
        .single();
      if (error || !created) {
        console.error("[pari] addExpense", error);
        return null;
      }

      const expenseId = created.id as string;

      if (input.allocations.length > 0) {
        await supabase.from("expense_splits").insert(
          input.allocations.map((allocation) => ({
            owner_user_id: userId,
            expense_id: expenseId,
            person_id: allocation.personId,
            amount_minor: allocation.amountMinor,
            percentage: allocation.percentage ?? null,
            shares: allocation.shares ?? null,
          })),
        );
      }

      if (input.items && input.items.length > 0) {
        await supabase.from("expense_items").insert(
          input.items.map((item, index) => ({
            owner_user_id: userId,
            expense_id: expenseId,
            name: item.name,
            quantity: item.quantity,
            unit_price_minor: item.unitPriceMinor,
            total_minor: itemTotalMinor(item),
            is_shared: item.isShared,
            position: index,
          })),
        );
      }

      await logActivity("expense_added", "expense", expenseId, input.groupId, {
        title,
        amount_minor: input.totalMinor,
      });
      await refresh();
      return created as unknown as Expense;
    };

    const updateExpense = async (id: string, input: UpdateExpenseInput) => {
      if (!userId) return;
      const patch: {
        title?: string;
        merchant?: string | null;
        paid_by_person_id?: string;
        total_minor?: number;
        expense_date?: string;
      } = {};
      if (input.title !== undefined) patch.title = input.title;
      if (input.merchant !== undefined) patch.merchant = input.merchant;
      if (input.paidByPersonId !== undefined) patch.paid_by_person_id = input.paidByPersonId;
      if (input.totalMinor !== undefined) patch.total_minor = input.totalMinor;
      if (input.expenseDate !== undefined) patch.expense_date = input.expenseDate;

      if (Object.keys(patch).length > 0) {
        await supabase.from("expenses").update(patch).eq("id", id);
      }

      if (input.allocations) {
        await supabase.from("expense_splits").delete().eq("expense_id", id);
        if (input.allocations.length > 0) {
          await supabase.from("expense_splits").insert(
            input.allocations.map((allocation) => ({
              owner_user_id: userId,
              expense_id: id,
              person_id: allocation.personId,
              amount_minor: allocation.amountMinor,
              percentage: allocation.percentage ?? null,
              shares: allocation.shares ?? null,
            })),
          );
        }
      }

      const existing = expenseById(id);
      await logActivity(
        input.allocations ? "split_changed" : "expense_updated",
        "expense",
        id,
        existing?.group_id ?? null,
        {
          title: input.title ?? existing?.title ?? "",
          amount_minor: input.totalMinor ?? existing?.total_minor ?? 0,
        },
      );
      await refresh();
    };

    const deleteExpense = async (id: string) => {
      const existing = expenseById(id);
      await supabase.from("expenses").delete().eq("id", id);
      await logActivity("expense_deleted", "expense", null, existing?.group_id ?? null, {
        title: existing?.title ?? "",
        amount_minor: existing?.total_minor ?? 0,
      });
      await refresh();
    };

    const addPerson = async (name: string): Promise<Person | null> => {
      if (!userId) return null;
      const trimmed = name.trim();
      if (!trimmed) return null;
      const existing = data.people.find(
        (p) => p.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (existing) return existing;
      const { data: created, error } = await supabase
        .from("people")
        .insert({ owner_user_id: userId, name: trimmed })
        .select()
        .single();
      if (error) {
        console.error("[pari] addPerson", error);
        return null;
      }
      await refresh();
      return created as unknown as Person;
    };

    const renamePerson = async (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      await supabase.from("people").update({ name: trimmed }).eq("id", id);
      await refresh();
    };

    const deletePerson = async (id: string) => {
      await supabase.from("people").delete().eq("id", id);
      await refresh();
    };

    const createGroup = async (input: CreateGroupInput): Promise<string | null> => {
      if (!userId) return null;
      const { data: group, error } = await supabase
        .from("groups")
        .insert({
          owner_user_id: userId,
          name: input.name.trim() || "Ny gruppe",
          default_split_type: input.defaultSplitType,
          currency: profile?.currency ?? "DKK",
        })
        .select()
        .single();
      if (error || !group) {
        console.error("[pari] createGroup", error);
        return null;
      }
      const groupId = group.id as string;

      const memberIds: string[] = [];
      for (const rawName of input.personNames) {
        const trimmed = rawName.trim();
        if (!trimmed) continue;
        const existing = data.people.find(
          (p) => p.name.toLowerCase() === trimmed.toLowerCase(),
        );
        if (existing) {
          if (!memberIds.includes(existing.id)) memberIds.push(existing.id);
          continue;
        }
        const { data: created } = await supabase
          .from("people")
          .insert({ owner_user_id: userId, name: trimmed })
          .select()
          .single();
        if (created) memberIds.push(created.id as string);
      }

      if (memberIds.length > 0) {
        await supabase.from("group_members").insert(
          memberIds.map((personId, index) => ({
            owner_user_id: userId,
            group_id: groupId,
            person_id: personId,
            role: index === 0 ? "owner" : "member",
            default_percentage: input.percentages?.[personId] ?? null,
          })),
        );
      }

      await logActivity("group_created", "group", groupId, groupId, { title: input.name });
      await refresh();
      return groupId;
    };

    const markSettled = async (groupId: string, step: SettlementStep) => {
      if (!userId) return;
      await supabase.from("settlements").insert({
        owner_user_id: userId,
        group_id: groupId,
        from_person_id: step.fromPersonId,
        to_person_id: step.toPersonId,
        amount_minor: step.amountMinor,
        currency: profile?.currency ?? "DKK",
        status: "settled",
        settled_at: nowIso(),
      });
      await logActivity("settlement_marked", "settlement", groupId, groupId, {
        amount_minor: step.amountMinor,
      });
      await refresh();
    };

    const updateProfile = async (
      patch: Partial<Pick<Profile, "display_name" | "language" | "currency" | "appearance">>,
    ) => {
      if (!userId) return;
      await supabase.from("profiles").update(patch).eq("id", userId);
      if (patch.display_name && selfPerson) {
        await supabase.from("people").update({ name: patch.display_name }).eq("id", selfPerson.id);
      }
      await refresh();
    };

    const signOut = async () => {
      await supabase.auth.signOut();
      queryClient.clear();
      clearGuestState();
      setGuestRaw(withSelfPerson(emptyGuestState));
      setDraftState(emptyDraft(""));
    };

    // ---- Guest (device-only) mutations -------------------------------------

    const guestAddPerson = async (name: string): Promise<Person | null> => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const existing = guest.people.find(
        (p) => p.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (existing) return existing;
      const person = makeGuestPerson(trimmed);
      setGuest((prev) => ({ ...prev, people: [...prev.people, person] }));
      return person;
    };

    const guestRenamePerson = async (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setGuest((prev) => ({
        ...prev,
        people: prev.people.map((p) => (p.id === id ? { ...p, name: trimmed } : p)),
      }));
    };

    const guestDeletePerson = async (id: string) => {
      setGuest((prev) => ({
        ...prev,
        people: prev.people.filter((p) => p.id === id ? false : true),
      }));
      setDraftState((prev) => ({
        ...prev,
        participants: prev.participants.filter((personId) => personId !== id),
      }));
    };


    const guestAddExpense = async (input: AddExpenseInput): Promise<Expense | null> => {
      const expense = makeGuestExpense({
        title: input.title || input.merchant || "Split",
        merchant: input.merchant,
        paidByPersonId: input.paidByPersonId,
        totalMinor: input.totalMinor,
        source: input.source,
        currency: "DKK",
        ...(input.expenseDate ? { expenseDate: input.expenseDate } : {}),
      });

      const splits = input.allocations.map((allocation) => ({
        id: makeGuestSplitId(),
        expense_id: expense.id,
        person_id: allocation.personId,
        amount_minor: allocation.amountMinor,
        percentage: allocation.percentage ?? null,
        shares: allocation.shares ?? null,
      }));

      const items = (input.items ?? []).map((item) => ({
        id: makeGuestItemId(),
        expense_id: expense.id,
        name: item.name,
        quantity: item.quantity,
        unit_price_minor: item.unitPriceMinor,
        total_minor: itemTotalMinor(item),
        category: null,
        is_shared: item.isShared,
        created_at: expense.created_at,
      }));

      setGuest((prev) => ({
        ...prev,
        expenses: [expense, ...prev.expenses],
        expenseSplits: [...prev.expenseSplits, ...splits],
        expenseItems: [...prev.expenseItems, ...items],
      }));
      return expense;
    };

    const guestDeleteExpense = async (id: string) => {
      setGuest((prev) => ({
        ...prev,
        expenses: prev.expenses.filter((e) => e.id !== id),
        expenseSplits: prev.expenseSplits.filter((s) => s.expense_id !== id),
        expenseItems: prev.expenseItems.filter((i) => i.expense_id !== id),
      }));
    };

    const notForGuests = (reason: AccountPromptReason) => () => {
      setAccountPrompt(reason);
      return Promise.resolve(null);
    };

    return {
      data,
      loading: !authReady || (Boolean(userId) && query.isLoading) || migrating,
      session,
      profile,

      language: (profile?.language as Language) ?? deviceLanguage,
      currency: profile?.currency ?? "DKK",
      appearance: (profile?.appearance as Appearance) ?? "system",
      currentPersonId,
      currentProfileName: profile?.display_name ?? selfPerson?.name ?? "PARI",
      personById,
      personName,
      groupPersonIds,
      groupExpenses,
      expenseById,
      expenseItems,
      expenseAllocations,
      groupBalances,
      myGroupBalance,
      netBalance,
      settlementPlan,
      recentExpenses,
      activityFeed,
      groupDefaultPercentages,
      addExpense: isGuest ? guestAddExpense : addExpense,
      updateExpense,
      deleteExpense: isGuest ? guestDeleteExpense : deleteExpense,
      createGroup: isGuest
        ? (notForGuests("create_group") as PariContextValue["createGroup"])
        : createGroup,
      markSettled: isGuest
        ? (async () => {
            setAccountPrompt("settle");
          })
        : markSettled,
      addPerson: isGuest ? guestAddPerson : addPerson,
      renamePerson: isGuest ? guestRenamePerson : renamePerson,
      deletePerson: isGuest ? guestDeletePerson : deletePerson,

      updateProfile,
      signOut,
      refresh,
      draft,
      setDraft: setDraftState,
      resetDraft: () => setDraftState(emptyDraft(currentPersonId)),
      authReady,
      isGuest,

      requireAccount: (reason: AccountPromptReason) => setAccountPrompt(reason),
      accountPrompt,
      dismissAccountPrompt: () => setAccountPrompt(null),
      migratingGuestData: migrating,
      guestMigrationFailed: migrationFailed,
    };

  }, [
    data,
    draft,
    profile,
    selfPerson,
    currentPersonId,
    userId,
    session,
    authReady,
    query.isLoading,
    queryClient,
    refresh,
    isGuest,
    guest,
    setGuest,
    accountPrompt,
    migrating,
    migrationFailed,
    deviceLanguage,
  ]);




  return <PariContext.Provider value={value}>{children}</PariContext.Provider>;
}

export function usePari() {
  const context = useContext(PariContext);
  if (!context) throw new Error("usePari must be used inside <PariProvider>");
  return context;
}
