/**
 * Domain model. Field names mirror the relational schema
 * (profiles, people, groups, group_members, expenses, expense_items,
 * expense_splits, item_splits, settlements, activity).
 */

import type { SplitMode } from "@/lib/split";
import type { Language } from "@/lib/i18n";

export type Appearance = "system" | "light" | "dark";

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  language: Language;
  currency: string;
  appearance: Appearance;
  created_at: string;
};

export type Person = {
  id: string;
  owner_user_id: string | null;
  linked_profile_id: string | null;
  name: string;
  avatar_url: string | null;
  is_self: boolean;
  created_at: string;
};

export type Group = {
  id: string;
  name: string;
  created_by: string;
  default_split_type: SplitMode;
  currency: string;
  created_at: string;
  archived_at: string | null;
};

export type GroupMember = {
  id: string;
  group_id: string;
  person_id: string;
  role: "owner" | "member";
  default_weight: number | null;
  default_percentage: number | null;
  joined_at: string;
  /** Set when the person no longer takes part in the group; history is kept. */
  removed_at?: string | null;
};

export type ExpenseSource = "manual" | "receipt";

export type Expense = {
  id: string;
  group_id: string | null;
  created_by: string;
  paid_by_person_id: string;
  title: string;
  merchant: string | null;
  expense_date: string;
  /** System currency at the time of saving. total_minor is in this currency. */
  currency: string;
  /** Converted amount, in system currency. Balances and settlement use this. */
  total_minor: number;
  /** Currency the money was actually spent in. */
  original_currency: string | null;
  /** Amount as printed on the receipt, in the original currency. */
  original_total_minor: number | null;
  /** Locked at confirmation: original -> system. 1 when they are the same. */
  exchange_rate: number;
  exchange_rate_date: string | null;
  exchange_rate_source: string;
  /** What the bank actually charged, when the user entered it. */
  card_charged_minor: number | null;
  source_type: ExpenseSource;
  created_at: string;
  updated_at: string;
};

export type ExpenseItem = {
  id: string;
  expense_id: string;
  name: string;
  quantity: number;
  unit_price_minor: number;
  total_minor: number;
  category: string | null;
  is_shared: boolean;
  created_at: string;
};

export type ExpenseSplit = {
  id: string;
  expense_id: string;
  person_id: string;
  /** Share in system currency. */
  amount_minor: number;
  /** Share in the original currency, before conversion. */
  original_amount_minor: number | null;
  percentage: number | null;
  shares: number | null;
};

export type ItemSplit = {
  id: string;
  expense_item_id: string;
  person_id: string;
  amount_minor: number;
  percentage: number | null;
  shares: number | null;
};

export type Settlement = {
  id: string;
  group_id: string;
  from_person_id: string;
  to_person_id: string;
  amount_minor: number;
  currency: string;
  status: "pending" | "settled";
  settled_at: string | null;
  created_at: string;
};

export type ActivityType =
  | "expense_added"
  | "expense_updated"
  | "expense_deleted"
  | "split_changed"
  | "settlement_marked"
  | "group_created";

export type ActivityEntry = {
  id: string;
  group_id: string | null;
  actor_person_id: string | null;
  activity_type: ActivityType;
  entity_type: "expense" | "settlement" | "group";
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type PariData = {
  profiles: Profile[];
  people: Person[];
  groups: Group[];
  groupMembers: GroupMember[];
  expenses: Expense[];
  expenseItems: ExpenseItem[];
  expenseSplits: ExpenseSplit[];
  itemSplits: ItemSplit[];
  settlements: Settlement[];
  activity: ActivityEntry[];
};

export const emptyPariData: PariData = {
  profiles: [],
  people: [],
  groups: [],
  groupMembers: [],
  expenses: [],
  expenseItems: [],
  expenseSplits: [],
  itemSplits: [],
  settlements: [],
  activity: [],
};
