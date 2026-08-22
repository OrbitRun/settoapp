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
import { diffExpense, type ExpenseSnapshot } from "@/lib/history";
import { lockMoney, type MoneyContext } from "@/lib/expense-money";
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
import { redeemInvitation, clearPendingInvite, readPendingInvite } from "./invitations";

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
  /** Total in the ORIGINAL currency. Conversion happens inside the store. */
  totalMinor: number;
  /** Shares in the ORIGINAL currency. */
  allocations: Allocation[];
  source: "manual" | "receipt";
  items?: DraftItem[];
  expenseDate?: string;
  /** Omitted when the purchase was already in the system currency. */
  money?: MoneyContext;
};

type CreateGroupInput = {
  name: string;
  personNames: string[];
  defaultSplitType: SplitMode;
  /**
   * Default rule values keyed by member key: "self" for the owner, otherwise the
   * lowercased person name — people only get ids once the group is created.
   */
  percentages?: Record<string, number>;
  shares?: Record<string, number>;
};

type UpdateGroupInput = {
  name?: string;
  defaultSplitType?: SplitMode;
  percentages?: Record<string, number> | null;
  shares?: Record<string, number> | null;
};

/** A group's saved default split rule, resolved to person ids. */
export type GroupRule = {
  mode: SplitMode;
  percentages: Record<string, number>;
  shares: Record<string, number>;
};

type UpdateExpenseInput = {
  title?: string;
  merchant?: string | null;
  paidByPersonId?: string;
  /** Total in the expense's original currency. */
  totalMinor?: number;
  /** Shares in the original currency. */
  allocations?: Allocation[];
  expenseDate?: string;
  groupId?: string | null;
  /** Supply to change currency, override the rate, or set the card amount. */
  money?: MoneyContext;
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
  /** Active members only. */
  groupPersonIds: (groupId: string) => string[];
  /** People removed from the group but still present in its history. */
  groupRemovedPersonIds: (groupId: string) => string[];
  /** Whether the person has any financial trace in the group. */
  personHasGroupHistory: (groupId: string, personId: string) => boolean;
  groupExpenses: (groupId: string) => Expense[];
  expenseById: (id: string) => Expense | undefined;
  expenseItems: (expenseId: string) => ExpenseItem[];
  expenseAllocations: (expenseId: string) => Allocation[];
  expenseOriginalAllocations: (expenseId: string) => Allocation[];
  groupBalances: (groupId: string) => Balance[];
  myGroupBalance: (groupId: string) => number;
  netBalance: number;
  settlementPlan: (groupId: string) => SettlementStep[];
  recentExpenses: (limit?: number) => Expense[];
  activityFeed: () => ActivityEntry[];
  /** Audit trail for one expense (created / edited / deleted), oldest first. */
  expenseHistory: (expenseId: string) => ActivityEntry[];
  groupDefaultPercentages: (groupId: string) => Record<string, number> | null;
  groupRule: (groupId: string) => GroupRule | null;
  addExpense: (input: AddExpenseInput) => Promise<Expense | null>;
  updateExpense: (id: string, input: UpdateExpenseInput) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  createGroup: (input: CreateGroupInput) => Promise<string | null>;
  updateGroup: (groupId: string, patch: UpdateGroupInput) => Promise<void>;
  addGroupMembers: (groupId: string, personIds: string[]) => Promise<void>;
  /**
   * Removes active membership. People without any financial trace are deleted,
   * everyone else keeps their record and history and is only deactivated.
   */
  removeGroupMember: (
    groupId: string,
    personId: string,
  ) => Promise<"deleted" | "deactivated" | "owner-self" | "not-allowed">;
  setGroupArchived: (groupId: string, archived: boolean) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  markSettled: (
    groupId: string,
    step: SettlementStep,
    options?: { amountMinor?: number; note?: string },
  ) => Promise<void>;
  addPerson: (name: string) => Promise<Person | null>;
  renamePerson: (id: string, name: string) => Promise<void>;
  deletePerson: (id: string) => Promise<void>;
  updateProfile: (
    patch: Partial<Pick<Profile, "display_name" | "language" | "currency" | "appearance">>,
  ) => Promise<void>;
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

  const profileRows = (profiles.data ?? []) as unknown as Profile[];
  let peopleRows = (people.data ?? []) as unknown as Person[];

  // Every account needs a "me" person — without it the split flow has nobody
  // to select and falls back to generic placeholders.
  if (!peopleRows.some((person) => person.owner_user_id === userId && person.is_self)) {
    const { data: created } = await supabase
      .from("people")
      .insert({
        owner_user_id: userId,
        linked_profile_id: userId,
        name: profileRows[0]?.display_name || "Mig",
        is_self: true,
      })
      .select()
      .single();
    if (created) peopleRows = [created as unknown as Person, ...peopleRows];
  }

  return {
    profiles: profileRows,
    people: peopleRows,
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
    const match = people.find((p) => p.name.toLowerCase() === guestPerson.name.toLowerCase());
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
  const ordered = [...state.expenses].sort((a, b) => a.expense_date.localeCompare(b.expense_date));

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
  const inviteRef = useRef(false);
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

  // An invitation opened while signed out is applied right after auth.
  useEffect(() => {
    if (!userId || inviteRef.current) return;
    const code = readPendingInvite();
    if (!code) return;
    inviteRef.current = true;
    void redeemInvitation(code)
      .then(async ({ status, groupId }) => {
        // Idempotent: an existing membership returns `already_member` and no
        // new row is written. Legacy memberships are never touched.
        if (status === "unauthenticated" || status === "error") {
          inviteRef.current = false;
          return;
        }
        clearPendingInvite();
        if (!groupId) return;
        await queryClient.invalidateQueries({ queryKey: ["pari"] });
        if (loadGuestState().expenses.length === 0) {
          navigate({ to: "/groups/$groupId", params: { groupId } });
        }
      })
      .catch((error) => console.error("[pari] pending invite", error));
  }, [userId, queryClient, navigate]);

  const value = useMemo<PariContextValue>(() => {
    const personById = (id: string) => data.people.find((p) => p.id === id);
    const personName = (id: string) => personById(id)?.name ?? "—";

    const groupPersonIds = (groupId: string) =>
      data.groupMembers
        .filter((m) => m.group_id === groupId && !m.removed_at)
        .map((m) => m.person_id);

    const groupRemovedPersonIds = (groupId: string) =>
      data.groupMembers
        .filter((m) => m.group_id === groupId && Boolean(m.removed_at))
        .map((m) => m.person_id);

    /** Any expense, split, settlement or activity trace inside this group. */
    const personHasGroupHistory = (groupId: string, personId: string) => {
      const expenseIds = data.expenses
        .filter((expense) => expense.group_id === groupId)
        .map((expense) => expense.id);
      return (
        data.expenses.some(
          (expense) => expense.group_id === groupId && expense.paid_by_person_id === personId,
        ) ||
        data.expenseSplits.some(
          (split) => expenseIds.includes(split.expense_id) && split.person_id === personId,
        ) ||
        data.itemSplits.some((split) => {
          if (split.person_id !== personId) return false;
          const item = data.expenseItems.find((i) => i.id === split.expense_item_id);
          return item ? expenseIds.includes(item.expense_id) : false;
        }) ||
        data.settlements.some(
          (settlement) =>
            settlement.group_id === groupId &&
            (settlement.from_person_id === personId || settlement.to_person_id === personId),
        )
      );
    };

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

    /** Shares as they were split, in the currency the money was spent in. */
    const expenseOriginalAllocations = (expenseId: string): Allocation[] =>
      data.expenseSplits
        .filter((s) => s.expense_id === expenseId)
        .map((s) => ({
          personId: s.person_id,
          amountMinor: s.original_amount_minor ?? s.amount_minor,
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
      // Removed members stay in the ledger until their balance is settled.
      const removedWithBalance = groupRemovedPersonIds(groupId).filter(
        (personId) => (balances.find((b) => b.personId === personId)?.netMinor ?? 0) !== 0,
      );
      return [...groupPersonIds(groupId), ...removedWithBalance].map(
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

    /**
     * One visible row per economic event: an expense surfaces through its
     * creation entry only, so later edits and its deletion stay in the
     * database as history instead of climbing to the top of the feed.
     */
    const activityFeed = () => {
      const sorted = [...data.activity].sort((a, b) => b.created_at.localeCompare(a.created_at));
      return sorted.filter((entry) => {
        if (entry.entity_type !== "expense") return true;
        return entry.activity_type === "expense_added" && Boolean(entry.entity_id);
      });
    };

    /** Full audit trail for one expense, oldest first. */
    const expenseHistory = (expenseId: string) =>
      data.activity
        .filter((entry) => entry.entity_type === "expense" && entry.entity_id === expenseId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));

    const groupRule = (groupId: string): GroupRule | null => {
      const group = data.groups.find((g) => g.id === groupId);
      if (!group) return null;
      const mode = (group.default_split_type as SplitMode) ?? "equal";
      const members = data.groupMembers.filter((m) => m.group_id === groupId);
      if (members.length === 0) return null;
      if (mode === "percentage") {
        if (members.some((m) => m.default_percentage == null)) return null;
        return {
          mode,
          percentages: Object.fromEntries(
            members.map((m) => [m.person_id, Number(m.default_percentage)]),
          ),
          shares: {},
        };
      }
      if (mode === "shares") {
        return {
          mode,
          percentages: {},
          shares: Object.fromEntries(
            members.map((m) => [m.person_id, Number(m.default_weight ?? 1)]),
          ),
        };
      }
      return { mode: "equal", percentages: {}, shares: {} };
    };

    const groupDefaultPercentages = (groupId: string) => {
      const group = data.groups.find((g) => g.id === groupId);
      if (!group || group.default_split_type !== "percentage") return null;
      const members = data.groupMembers.filter((m) => m.group_id === groupId);
      if (members.length === 0 || members.some((m) => m.default_percentage == null)) return null;
      return Object.fromEntries(members.map((m) => [m.person_id, Number(m.default_percentage)]));
    };

    const logActivity = async (
      type: ActivityType,
      entityType: "expense" | "settlement" | "group",
      entityId: string | null,
      groupId: string | null,
      metadata: Record<string, unknown>,
    ) => {
      if (!userId) return;
      await supabase.from("activity").insert({
        owner_user_id: userId,
        group_id: groupId,
        actor_person_id: currentPersonId || null,
        activity_type: type,
        entity_type: entityType,
        entity_id: entityId,
        metadata: metadata as never,
      });
    };

    const addExpense = async (input: AddExpenseInput): Promise<Expense | null> => {
      if (!userId) return null;
      const title = input.title || input.merchant || "Udgift";
      const locked = lockMoney({
        systemCurrency: profile?.currency ?? "DKK",
        originalTotalMinor: input.totalMinor,
        allocations: input.allocations,
        money: input.money,
      });
      const { data: created, error } = await supabase
        .from("expenses")
        .insert({
          owner_user_id: userId,
          group_id: input.groupId,
          paid_by_person_id: input.paidByPersonId,
          title,
          merchant: input.merchant,
          total_minor: locked.totalMinor,
          source_type: input.source,
          currency: locked.currency,
          original_currency: locked.originalCurrency,
          original_total_minor: locked.originalTotalMinor,
          exchange_rate: locked.exchangeRate,
          exchange_rate_date: locked.exchangeRateDate,
          exchange_rate_source: locked.exchangeRateSource,
          card_charged_minor: locked.cardChargedMinor,
          expense_date: input.expenseDate ?? nowIso(),
        })
        .select()
        .single();
      if (error || !created) {
        console.error("[pari] addExpense", error);
        return null;
      }

      const expenseId = created.id as string;

      if (locked.allocations.length > 0) {
        await supabase.from("expense_splits").insert(
          locked.allocations.map((allocation) => ({
            owner_user_id: userId,
            expense_id: expenseId,
            person_id: allocation.personId,
            amount_minor: allocation.amountMinor,
            original_amount_minor: locked.originalByPerson[allocation.personId] ?? null,
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
      const current = expenseById(id);
      // Snapshot the expense as it stands so the edit can be described later
      // in human terms instead of as a raw database diff.
      const before: ExpenseSnapshot | null = current
        ? {
            title: current.title,
            totalMinor: current.original_total_minor ?? current.total_minor,
            currency: current.original_currency ?? current.currency,
            systemCurrency: current.currency,
            exchangeRate: Number(current.exchange_rate) || 1,
            payerId: current.paid_by_person_id,
            groupId: current.group_id,
            allocations: expenseOriginalAllocations(id),
            items: expenseItems(id).map((item) => ({
              name: item.name,
              totalMinor: item.total_minor,
            })),
          }
        : null;
      // Editing keeps the expense in its original currency; the rate stays locked
      // unless the user supplies a new one (manual override or card amount).
      const money: MoneyContext | undefined =
        input.money ??
        (current && current.original_currency && current.original_currency !== current.currency
          ? {
              currency: current.original_currency,
              exchangeRate: Number(current.exchange_rate) || 1,
              exchangeRateDate: current.exchange_rate_date,
              exchangeRateSource: current.exchange_rate_source,
              cardChargedMinor: current.card_charged_minor,
            }
          : undefined);

      const locked =
        input.totalMinor !== undefined || input.allocations || input.money
          ? lockMoney({
              systemCurrency: profile?.currency ?? current?.currency ?? "DKK",
              originalTotalMinor:
                input.totalMinor ?? current?.original_total_minor ?? current?.total_minor ?? 0,
              allocations: input.allocations ?? [],
              ...(money ? { money } : {}),
            })
          : null;

      const patch: {
        title?: string;
        merchant?: string | null;
        paid_by_person_id?: string;
        total_minor?: number;
        expense_date?: string;
        group_id?: string | null;
        currency?: string;
        original_currency?: string;
        original_total_minor?: number;
        exchange_rate?: number;
        exchange_rate_date?: string | null;
        exchange_rate_source?: string;
        card_charged_minor?: number | null;
      } = {};
      if (input.title !== undefined) patch.title = input.title;
      if (input.merchant !== undefined) patch.merchant = input.merchant;
      if (input.paidByPersonId !== undefined) patch.paid_by_person_id = input.paidByPersonId;
      if (input.expenseDate !== undefined) patch.expense_date = input.expenseDate;
      if (input.groupId !== undefined) patch.group_id = input.groupId;
      if (locked) {
        patch.total_minor = locked.totalMinor;
        patch.currency = locked.currency;
        patch.original_currency = locked.originalCurrency;
        patch.original_total_minor = locked.originalTotalMinor;
        patch.exchange_rate = locked.exchangeRate;
        patch.exchange_rate_date = locked.exchangeRateDate;
        patch.exchange_rate_source = locked.exchangeRateSource;
        patch.card_charged_minor = locked.cardChargedMinor;
      }

      if (Object.keys(patch).length > 0) {
        await supabase.from("expenses").update(patch).eq("id", id);
      }

      if (input.allocations && locked) {
        await supabase.from("expense_splits").delete().eq("expense_id", id);
        if (locked.allocations.length > 0) {
          await supabase.from("expense_splits").insert(
            locked.allocations.map((allocation) => ({
              owner_user_id: userId,
              expense_id: id,
              person_id: allocation.personId,
              amount_minor: allocation.amountMinor,
              original_amount_minor: locked.originalByPerson[allocation.personId] ?? null,
              percentage: allocation.percentage ?? null,
              shares: allocation.shares ?? null,
            })),
          );
        }
      }

      // One meaningful activity entry per edit — never one per changed field.
      const existing = expenseById(id);
      const after: ExpenseSnapshot | null = before
        ? {
            title: input.title ?? before.title,
            totalMinor: locked ? locked.originalTotalMinor : before.totalMinor,
            currency: locked ? locked.originalCurrency : before.currency,
            systemCurrency: locked ? locked.currency : before.systemCurrency,
            exchangeRate: locked ? locked.exchangeRate : before.exchangeRate,
            payerId: input.paidByPersonId ?? before.payerId,
            groupId: input.groupId !== undefined ? input.groupId : before.groupId,
            allocations:
              input.allocations && locked
                ? locked.allocations.map((allocation) => ({
                    ...allocation,
                    amountMinor:
                      locked.originalByPerson[allocation.personId] ?? allocation.amountMinor,
                  }))
                : before.allocations,
            items: before.items,
          }
        : null;
      const changes = before && after ? diffExpense(before, after) : {};

      await logActivity(
        "expense_updated",
        "expense",
        id,
        input.groupId !== undefined ? input.groupId : (existing?.group_id ?? null),
        {
          title: input.title ?? existing?.title ?? "",
          amount_minor: input.totalMinor ?? existing?.total_minor ?? 0,
          ...(Object.keys(changes).length > 0 ? { changes } : {}),
        },
      );

      await refresh();
    };

    const deleteExpense = async (id: string) => {
      const existing = expenseById(id);
      await supabase.from("expenses").delete().eq("id", id);
      // Keeps the deletion attached to the expense's own history instead of
      // becoming a separate feed row.
      await logActivity("expense_deleted", "expense", id, existing?.group_id ?? null, {
        title: existing?.title ?? "",
        amount_minor: existing?.total_minor ?? 0,
      });
      await refresh();
    };

    const addPerson = async (name: string): Promise<Person | null> => {
      if (!userId) return null;
      const trimmed = name.trim();
      if (!trimmed) return null;
      const existing = data.people.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
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

    /** The group a placeholder belongs to and that the caller currently owns. */
    const ownedGroupForPerson = (personId: string) => {
      const memberships = data.groupMembers.filter((m) => m.person_id === personId);
      const owned = memberships.find((m) =>
        data.groups.some(
          (g) => g.id === m.group_id && g.owner_person_id === currentPersonId,
        ),
      );
      return owned?.group_id ?? null;
    };

    const renamePerson = async (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const { data: updated } = await supabase
        .from("people")
        .update({ name: trimmed })
        .eq("id", id)
        .select("id");

      // A placeholder created by a previous group owner is no longer writable
      // through the table; the current durable owner goes through the RPC.
      if (!updated || updated.length === 0) {
        const groupId = ownedGroupForPerson(id);
        if (groupId) {
          await supabase.rpc("rename_group_placeholder", {
            _group_id: groupId,
            _person_id: id,
            _name: trimmed,
          });
        }
      }
      await refresh();
    };

    const deletePerson = async (id: string) => {
      const { data: removed } = await supabase
        .from("people")
        .delete()
        .eq("id", id)
        .select("id");

      if (!removed || removed.length === 0) {
        const groupId = ownedGroupForPerson(id);
        if (groupId) {
          await supabase.rpc("delete_unused_group_placeholder", {
            _group_id: groupId,
            _person_id: id,
          });
        }
      }
      await refresh();
    };


    const createGroup = async (input: CreateGroupInput): Promise<string | null> => {
      if (!userId) return null;
      // One atomic backend operation: group, owner person, memberships and the
      // group_created activity are written together or not at all.
      const { data: groupId, error } = await supabase.rpc("create_group", {
        _name: input.name,
        _default_split_type: input.defaultSplitType,
        _person_names: input.personNames,
        _percentages: (input.percentages ?? {}) as never,
        _shares: (input.shares ?? {}) as never,
      });
      if (error || !groupId) {
        console.error("[pari] createGroup", error);
        return null;
      }
      await refresh();
      return groupId as string;
    };

    const updateGroup = async (groupId: string, patch: UpdateGroupInput) => {
      if (!userId) return;
      const groupPatch: { name?: string; default_split_type?: SplitMode } = {};
      if (patch.name !== undefined) groupPatch.name = patch.name.trim() || "Gruppe";
      if (patch.defaultSplitType !== undefined) {
        groupPatch.default_split_type = patch.defaultSplitType;
      }
      if (Object.keys(groupPatch).length > 0) {
        await supabase.from("groups").update(groupPatch).eq("id", groupId);
      }

      if (patch.percentages !== undefined || patch.shares !== undefined) {
        for (const personId of groupPersonIds(groupId)) {
          const memberPatch: {
            default_percentage?: number | null;
            default_weight?: number | null;
          } = {};
          if (patch.percentages !== undefined) {
            memberPatch.default_percentage = patch.percentages?.[personId] ?? null;
          }
          if (patch.shares !== undefined) {
            memberPatch.default_weight = patch.shares?.[personId] ?? null;
          }
          await supabase
            .from("group_members")
            .update(memberPatch)
            .eq("group_id", groupId)
            .eq("person_id", personId);
        }
      }
      await refresh();
    };

    const addGroupMembers = async (groupId: string, personIds: string[]) => {
      if (!userId) return;
      const active = groupPersonIds(groupId);
      const removed = groupRemovedPersonIds(groupId);

      // Someone who was removed earlier gets their original record back.
      const toRestore = personIds.filter((personId) => removed.includes(personId));
      for (const personId of toRestore) {
        await supabase
          .from("group_members")
          .update({ removed_at: null })
          .eq("group_id", groupId)
          .eq("person_id", personId);
      }

      const rows = personIds
        .filter((personId) => !active.includes(personId) && !removed.includes(personId))
        .map((personId) => ({
          owner_user_id: userId,
          group_id: groupId,
          person_id: personId,
          role: "member",
        }));
      if (rows.length > 0) await supabase.from("group_members").insert(rows);
      if (rows.length === 0 && toRestore.length === 0) return;
      await refresh();
    };

    const removeGroupMember = async (
      groupId: string,
      personId: string,
    ): Promise<"deleted" | "deactivated" | "owner-self" | "not-allowed"> => {
      const group = data.groups.find((g) => g.id === groupId);
      // Only the group owner may write group_members (enforced server-side too).
      if (!userId || !group) return "not-allowed";

      const person = data.people.find((p) => p.id === personId);
      // The group owner cannot remove themselves from their own group.
      if (person?.linked_profile_id === userId || personId === currentPersonId) {
        return "owner-self";
      }

      if (personHasGroupHistory(groupId, personId)) {
        await supabase
          .from("group_members")
          .update({ removed_at: nowIso() })
          .eq("group_id", groupId)
          .eq("person_id", personId);
        await refresh();
        return "deactivated";
      }

      await supabase
        .from("group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("person_id", personId);

      // A person record created only for this group and never used anywhere
      // else is a duplicate — clean it up so it stops showing in pickers.
      const usedElsewhere =
        data.groupMembers.some((m) => m.person_id === personId && m.group_id !== groupId) ||
        data.expenses.some((e) => e.paid_by_person_id === personId) ||
        data.expenseSplits.some((s) => s.person_id === personId) ||
        data.settlements.some(
          (s) => s.from_person_id === personId || s.to_person_id === personId,
        );
      if (!usedElsewhere && person && !person.is_self && !person.linked_profile_id) {
        await supabase.from("people").delete().eq("id", personId);
      }
      await refresh();
      return "deleted";
    };

    const setGroupArchived = async (groupId: string, archived: boolean) => {
      await supabase
        .from("groups")
        .update({ archived_at: archived ? nowIso() : null })
        .eq("id", groupId);
      await refresh();
    };

    /**
     * Removes the group and everything that only belongs to it.
     *
     * The group row MUST be deleted first: durable group-owner authorization
     * reads the owner's active `role = 'owner'` membership, so removing
     * group_members up front would destroy the evidence the DELETE policy
     * needs. Every group-scoped child table (group_members, expenses ->
     * expense_items/expense_splits -> item_splits, settlements, activity,
     * group_invitations) has ON DELETE CASCADE on group_id, so the database
     * cleans them up for us.
     */
    const deleteGroup = async (groupId: string) => {
      const { data: deleted, error } = await supabase
        .from("groups")
        .delete()
        .eq("id", groupId)
        .select("id");

      if (error) throw error;
      if (!deleted || deleted.length !== 1) {
        throw new Error("Group deletion did not affect exactly one group.");
      }

      await refresh();
    };


    /**
     * Registers a payment as its own settlement transaction. Partial payments
     * pass a smaller amountMinor; balances are always recalculated from
     * expenses + splits + settlements, never overwritten.
     */
    const markSettled = async (
      groupId: string,
      step: SettlementStep,
      options?: { amountMinor?: number; note?: string },
    ) => {
      if (!userId) return;
      const paid = Math.round(options?.amountMinor ?? step.amountMinor);
      if (paid <= 0 || paid > step.amountMinor) return;
      await supabase.from("settlements").insert({
        owner_user_id: userId,
        group_id: groupId,
        from_person_id: step.fromPersonId,
        to_person_id: step.toPersonId,
        amount_minor: paid,
        currency: profile?.currency ?? "DKK",
        status: "settled",
        settled_at: nowIso(),
      });
      await logActivity("settlement_marked", "settlement", groupId, groupId, {
        amount_minor: paid,
        from_person_id: step.fromPersonId,
        to_person_id: step.toPersonId,
        remaining_minor: step.amountMinor - paid,
        ...(options?.note ? { note: options.note } : {}),
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
      const existing = guest.people.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
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
        people: prev.people.filter((p) => (p.id === id ? false : true)),
      }));
      setDraftState((prev) => ({
        ...prev,
        participants: prev.participants.filter((personId) => personId !== id),
      }));
    };

    const guestAddExpense = async (input: AddExpenseInput): Promise<Expense | null> => {
      const locked = lockMoney({
        systemCurrency: profile?.currency ?? "DKK",
        originalTotalMinor: input.totalMinor,
        allocations: input.allocations,
        money: input.money,
      });
      const expense = makeGuestExpense({
        title: input.title || input.merchant || "Split",
        merchant: input.merchant,
        paidByPersonId: input.paidByPersonId,
        totalMinor: locked.totalMinor,
        source: input.source,
        currency: locked.currency,
        originalCurrency: locked.originalCurrency,
        originalTotalMinor: locked.originalTotalMinor,
        exchangeRate: locked.exchangeRate,
        exchangeRateDate: locked.exchangeRateDate,
        exchangeRateSource: locked.exchangeRateSource,
        cardChargedMinor: locked.cardChargedMinor,
        ...(input.expenseDate ? { expenseDate: input.expenseDate } : {}),
      });

      const splits = locked.allocations.map((allocation) => ({
        id: makeGuestSplitId(),
        expense_id: expense.id,
        person_id: allocation.personId,
        amount_minor: allocation.amountMinor,
        original_amount_minor: locked.originalByPerson[allocation.personId] ?? null,
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
      // The "me" person is the identity used in every split, so it wins over
      // the generic profile default.
      currentProfileName: selfPerson?.name || profile?.display_name || "PARI",

      personById,
      personName,
      groupPersonIds,
      groupRemovedPersonIds,
      personHasGroupHistory,
      groupExpenses,
      expenseById,
      expenseItems,
      expenseAllocations,
      expenseOriginalAllocations,
      groupBalances,
      myGroupBalance,
      netBalance,
      settlementPlan,
      recentExpenses,
      activityFeed,
      expenseHistory,
      groupDefaultPercentages,
      groupRule,
      addExpense: isGuest ? guestAddExpense : addExpense,
      updateExpense,
      deleteExpense: isGuest ? guestDeleteExpense : deleteExpense,
      createGroup: isGuest
        ? (notForGuests("create_group") as PariContextValue["createGroup"])
        : createGroup,
      updateGroup,
      addGroupMembers,
      removeGroupMember,
      setGroupArchived,
      deleteGroup,
      markSettled: isGuest
        ? async () => {
            setAccountPrompt("settle");
          }
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
