/**
 * Runtime normalization for activity rows.
 *
 * The database column `activity_type` is a plain string, so rows written by
 * newer server-side features (for example `ownership_transferred`) can reach a
 * client build that does not know them yet. Looking such a value up in a fixed
 * `Record<ActivityType, string>` yields `undefined`, and translating an
 * `undefined` key with variables throws — which used to take down the whole
 * Activity page. The helpers below keep unknown rows renderable instead.
 */

import type { ActivityEntry, ActivityType } from "@/data/types";

export const ACTIVITY_TYPES: ActivityType[] = [
  "expense_added",
  "expense_updated",
  "expense_deleted",
  "split_changed",
  "settlement_marked",
  "group_created",
];

const ENTITY_TYPES = ["expense", "settlement", "group"] as const;

export function isKnownActivityType(value: unknown): value is ActivityType {
  return typeof value === "string" && (ACTIVITY_TYPES as string[]).includes(value);
}

const LABEL_KEYS: Record<ActivityType, string> = {
  expense_added: "activity.expenseAdded",
  expense_updated: "activity.expenseUpdated",
  expense_deleted: "activity.expenseDeleted",
  split_changed: "activity.splitChanged",
  settlement_marked: "activity.settlementMarked",
  group_created: "activity.groupCreated",
};

const HISTORY_KEYS: Record<ActivityType, string> = {
  expense_added: "activity.historyCreated",
  expense_updated: "activity.historyEdited",
  expense_deleted: "activity.historyDeleted",
  split_changed: "activity.historySplit",
  settlement_marked: "activity.historyEdited",
  group_created: "activity.historyCreated",
};

/** Always a real translation key, for any string the database may hold. */
export function activityLabelKey(type: string): string {
  return isKnownActivityType(type) ? LABEL_KEYS[type] : "activity.unknownEvent";
}

export function activityHistoryKey(type: string): string {
  return isKnownActivityType(type) ? HISTORY_KEYS[type] : "activity.historyUnknown";
}

/**
 * Coerces one raw database row into a shape the feed can always render:
 * a string activity type, a known entity type and an object metadata bag.
 * Nothing is dropped — unknown types are preserved verbatim.
 */
export function normalizeActivityEntry(raw: unknown): ActivityEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row["id"] !== "string") return null;

  const metadata =
    row["metadata"] && typeof row["metadata"] === "object" && !Array.isArray(row["metadata"])
      ? (row["metadata"] as Record<string, unknown>)
      : {};

  const entityType = (ENTITY_TYPES as readonly string[]).includes(String(row["entity_type"]))
    ? (row["entity_type"] as ActivityEntry["entity_type"])
    : "group";

  return {
    id: row["id"],
    group_id: typeof row["group_id"] === "string" ? row["group_id"] : null,
    actor_person_id: typeof row["actor_person_id"] === "string" ? row["actor_person_id"] : null,
    activity_type: String(row["activity_type"] ?? "") as ActivityType,
    entity_type: entityType,
    entity_id: typeof row["entity_id"] === "string" ? row["entity_id"] : null,
    metadata,
    created_at: typeof row["created_at"] === "string" ? row["created_at"] : new Date(0).toISOString(),
  };
}

export function normalizeActivityRows(rows: unknown): ActivityEntry[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map(normalizeActivityEntry)
    .filter((entry): entry is ActivityEntry => entry !== null);
}
