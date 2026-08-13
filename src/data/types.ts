/**
 * Domain model. Field names mirror the intended relational schema
 * (profiles, people, groups, group_members, expenses, expense_items,
 * expense_splits, item_splits, settlements, activity) so the in-memory store
 * can later be swapped for a database without touching screens.
 */

import type { SplitMode } from "@/lib/split";

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
};

export type Person = {
  id: string;
  owner_user_id: string | null;
  linked_profile_id: string | null;
  name: string;
  avatar_url: string | null;
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
  currency: string;
  total_minor: number;
  source_type: ExpenseSource;
  receipt_image_url: string | null;
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
  amount_minor: number;
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
  | "split_changed"
  | "settlement_marked"
  | "group_created";

export type ActivityEntry = {
  id: string;
  group_id: string | null;
  actor_profile_id: string;
  activity_type: ActivityType;
  entity_type: "expense" | "settlement" | "group";
  entity_id: string;
  metadata: Record<string, string | number>;
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
