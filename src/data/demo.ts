import { calculateEqualSplit, calculatePercentageSplit } from "@/lib/split";
import type {
  ActivityEntry,
  Expense,
  ExpenseItem,
  ExpenseSplit,
  GroupMember,
  PariData,
} from "./types";

export const CURRENT_PROFILE_ID = "profile_peter";
export const CURRENT_PERSON_ID = "person_peter";

const iso = (daysAgo: number, hour = 18) => {
  const d = new Date();
  d.setHours(hour, 5, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
};

const person = (id: string, name: string, linked: string | null = null) => ({
  id: `person_${id}`,
  owner_user_id: CURRENT_PROFILE_ID,
  linked_profile_id: linked,
  name,
  avatar_url: null,
  created_at: iso(120),
});

const people = [
  person("peter", "Peter", CURRENT_PROFILE_ID),
  person("mads", "Mads"),
  person("sofie", "Sofie"),
  person("emma", "Emma"),
  person("anna", "Anna"),
  person("jonas", "Jonas"),
  person("marie", "Marie"),
];

const P = {
  peter: "person_peter",
  mads: "person_mads",
  sofie: "person_sofie",
  emma: "person_emma",
  anna: "person_anna",
  jonas: "person_jonas",
  marie: "person_marie",
};

const BOFAELLES = ["person_peter", "person_mads", "person_sofie", "person_emma"];
const SOMMERHUS = [
  "person_peter",
  "person_mads",
  "person_sofie",
  "person_emma",
  "person_jonas",
  "person_marie",
];
const COUPLE = ["person_peter", "person_anna"];

const member = (
  groupId: string,
  personId: string,
  index: number,
  percentage: number | null = null,
): GroupMember => ({
  id: `gm_${groupId}_${personId}`,
  group_id: groupId,
  person_id: personId,
  role: index === 0 ? "owner" : "member",
  default_weight: null,
  default_percentage: percentage,
  joined_at: iso(100),
});

type Seed = {
  id: string;
  group: string | null;
  title: string;
  merchant?: string;
  paidBy: string;
  totalMinor: number;
  daysAgo: number;
  participants: string[];
  source?: "manual" | "receipt";
  percentages?: Record<string, number>;
};

const seeds: Seed[] = [
  // Bofællesskabet — Peter net +428,00
  {
    id: "exp_netto_bo",
    group: "group_bo",
    title: "Netto",
    merchant: "Netto",
    paidBy: P.peter,
    totalMinor: 48600,
    daysAgo: 0,
    participants: BOFAELLES,
    source: "receipt",
  },
  {
    id: "exp_internet",
    group: "group_bo",
    title: "Internet",
    paidBy: P.peter,
    totalMinor: 34900,
    daysAgo: 6,
    participants: BOFAELLES,
  },
  {
    id: "exp_pizza",
    group: "group_bo",
    title: "Fredagspizza",
    merchant: "Pizzeria Roma",
    paidBy: P.mads,
    totalMinor: 79300,
    daysAgo: 3,
    participants: BOFAELLES,
  },

  // Sommerhus 2026 — Peter net +620,00
  {
    id: "exp_netto_sh",
    group: "group_sommerhus",
    title: "Netto",
    merchant: "Netto",
    paidBy: P.peter,
    totalMinor: 124800,
    daysAgo: 9,
    participants: SOMMERHUS,
    source: "receipt",
  },
  {
    id: "exp_shell",
    group: "group_sommerhus",
    title: "Shell",
    merchant: "Shell",
    paidBy: P.mads,
    totalMinor: 61200,
    daysAgo: 1,
    participants: SOMMERHUS,
  },
  {
    id: "exp_firewood",
    group: "group_sommerhus",
    title: "Brænde",
    paidBy: P.peter,
    totalMinor: 25000,
    daysAgo: 8,
    participants: SOMMERHUS,
  },
  {
    id: "exp_restaurant",
    group: "group_sommerhus",
    title: "Restaurant",
    merchant: "Havnegrillen",
    paidBy: P.emma,
    totalMinor: 218000,
    daysAgo: 7,
    participants: SOMMERHUS,
  },
  {
    id: "exp_rema",
    group: "group_sommerhus",
    title: "Rema 1000",
    merchant: "Rema 1000",
    paidBy: P.marie,
    totalMinor: 97794,
    daysAgo: 8,
    participants: SOMMERHUS,
  },

  // Anna & Peter — 60/40, Peter net −200,00
  {
    id: "exp_el",
    group: "group_couple",
    title: "Elregning",
    paidBy: P.peter,
    totalMinor: 100000,
    daysAgo: 12,
    participants: COUPLE,
    percentages: { person_peter: 60, person_anna: 40 },
  },
  {
    id: "exp_irma",
    group: "group_couple",
    title: "Storindkøb",
    merchant: "Irma",
    paidBy: P.anna,
    totalMinor: 100000,
    daysAgo: 4,
    participants: COUPLE,
    percentages: { person_peter: 60, person_anna: 40 },
  },
];

const expenses: Expense[] = seeds.map((seed) => ({
  id: seed.id,
  group_id: seed.group,
  created_by: CURRENT_PROFILE_ID,
  paid_by_person_id: seed.paidBy,
  title: seed.title,
  merchant: seed.merchant ?? null,
  expense_date: iso(seed.daysAgo),
  currency: "DKK",
  total_minor: seed.totalMinor,
  source_type: seed.source ?? "manual",
  receipt_image_url: null,
  created_at: iso(seed.daysAgo),
  updated_at: iso(seed.daysAgo),
}));

const expenseSplits: ExpenseSplit[] = seeds.flatMap((seed) => {
  const allocations = seed.percentages
    ? calculatePercentageSplit(
        seed.totalMinor,
        seed.participants.map((personId) => ({
          personId,
          percentage: seed.percentages![personId] ?? 0,
        })),
      )
    : calculateEqualSplit(seed.totalMinor, seed.participants);

  return allocations.map((allocation) => ({
    id: `split_${seed.id}_${allocation.personId}`,
    expense_id: seed.id,
    person_id: allocation.personId,
    amount_minor: allocation.amountMinor,
    percentage: allocation.percentage ?? null,
    shares: null,
  }));
});

const nettoItems: ExpenseItem[] = [
  ["Bananer", 2400],
  ["Kylling", 6500],
  ["Toiletpapir", 4200],
  ["Proteinshake", 2800],
  ["Opvasketabs", 5500],
  ["Olivenolie", 8200],
  ["Rugbrød", 2600],
  ["Kaffe", 5400],
  ["Æg", 3500],
  ["Mælk", 3500],
].map(([name, total], index) => ({
  id: `item_netto_${index}`,
  expense_id: "exp_netto_bo",
  name: name as string,
  quantity: 1,
  unit_price_minor: total as number,
  total_minor: total as number,
  category: null,
  is_shared: true,
  created_at: iso(0),
}));

const activity: ActivityEntry[] = [
  {
    id: "act_1",
    group_id: "group_bo",
    actor_profile_id: CURRENT_PROFILE_ID,
    activity_type: "expense_added",
    entity_type: "expense",
    entity_id: "exp_netto_bo",
    metadata: { actor: "Peter", title: "Netto", amount_minor: 48600 },
    created_at: iso(0, 17),
  },
  {
    id: "act_2",
    group_id: "group_sommerhus",
    actor_profile_id: CURRENT_PROFILE_ID,
    activity_type: "expense_added",
    entity_type: "expense",
    entity_id: "exp_shell",
    metadata: { actor: "Mads", title: "Shell", amount_minor: 61200 },
    created_at: iso(1, 14),
  },
  {
    id: "act_3",
    group_id: "group_sommerhus",
    actor_profile_id: CURRENT_PROFILE_ID,
    activity_type: "split_changed",
    entity_type: "expense",
    entity_id: "exp_restaurant",
    metadata: { actor: "Sofie", title: "Restaurant", amount_minor: 218000 },
    created_at: iso(2, 20),
  },
  {
    id: "act_4",
    group_id: "group_bo",
    actor_profile_id: CURRENT_PROFILE_ID,
    activity_type: "settlement_marked",
    entity_type: "settlement",
    entity_id: "settle_1",
    metadata: { actor: "Emma", amount_minor: 42700 },
    created_at: iso(3, 11),
  },
  {
    id: "act_5",
    group_id: "group_couple",
    actor_profile_id: CURRENT_PROFILE_ID,
    activity_type: "expense_added",
    entity_type: "expense",
    entity_id: "exp_irma",
    metadata: { actor: "Anna", title: "Storindkøb", amount_minor: 100000 },
    created_at: iso(4, 16),
  },
];

export const demoData: PariData = {
  profiles: [
    {
      id: CURRENT_PROFILE_ID,
      display_name: "Peter",
      avatar_url: null,
      created_at: iso(200),
    },
  ],
  people,
  groups: [
    {
      id: "group_bo",
      name: "Bofællesskabet",
      created_by: CURRENT_PROFILE_ID,
      default_split_type: "equal",
      currency: "DKK",
      created_at: iso(100),
      archived_at: null,
    },
    {
      id: "group_sommerhus",
      name: "Sommerhus 2026",
      created_by: CURRENT_PROFILE_ID,
      default_split_type: "equal",
      currency: "DKK",
      created_at: iso(40),
      archived_at: null,
    },
    {
      id: "group_couple",
      name: "Anna & Peter",
      created_by: CURRENT_PROFILE_ID,
      default_split_type: "percentage",
      currency: "DKK",
      created_at: iso(180),
      archived_at: null,
    },
    {
      id: "group_ski",
      name: "Skiferie",
      created_by: CURRENT_PROFILE_ID,
      default_split_type: "equal",
      currency: "DKK",
      created_at: iso(20),
      archived_at: null,
    },
  ],
  groupMembers: [
    ...BOFAELLES.map((id, i) => member("group_bo", id, i)),
    ...SOMMERHUS.map((id, i) => member("group_sommerhus", id, i)),
    member("group_couple", P.peter, 0, 60),
    member("group_couple", P.anna, 1, 40),
    ...[P.peter, P.mads, P.sofie].map((id, i) => member("group_ski", id, i)),
  ],
  expenses,
  expenseItems: nettoItems,
  expenseSplits,
  itemSplits: [],
  settlements: [],
  activity,
};
