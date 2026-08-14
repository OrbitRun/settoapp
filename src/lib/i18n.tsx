import { createContext, useContext, useMemo, type ReactNode } from "react";

export type Language = "da" | "en";

type Dict = Record<string, string>;

const en: Dict = {
  "app.tagline": "Share anything. Settle easily.",
  "nav.home": "Home",
  "nav.groups": "Groups",
  "nav.split": "Split",
  "nav.activity": "Activity",
  "nav.profile": "Profile",

  "greeting.morning": "Good morning, {name}",
  "greeting.afternoon": "Good afternoon, {name}",
  "greeting.evening": "Good evening, {name}",

  "common.back": "Back",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.done": "Done",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.close": "Close",
  "common.continue": "Continue",
  "common.selectAll": "Select all",
  "common.deselectAll": "Deselect all",
  "common.today": "Today",
  "common.yesterday": "Yesterday",
  "common.loading": "Loading…",
  "common.you": "You",
  "common.unknown": "Unknown",
  "common.people": "people",
  "common.members": "members",

  "balance.owed": "You're owed",
  "balance.owe": "You owe",
  "balance.settled": "Settled",
  "balance.allSettled": "All settled",
  "common.memberCount": "{count} members",

  "home.settled": "Everything is settled.",
  "home.acrossGroups": "Across {count} groups",
  "home.yourGroups": "Your groups",
  "home.seeAll": "See all",
  "home.recent": "Recent",
  "home.noExpenses": "No shared expenses yet",
  "home.noExpensesHint": "Split your first expense in seconds.",
  "home.paidBy": "Paid by {name}",

  "groups.title": "Groups",
  "groups.create": "Create group",
  "groups.none": "No groups yet",
  "groups.noneHint": "A group keeps one running balance for the people you share with.",
  "groups.expenses": "Expenses",
  "groups.people": "People",
  "groups.rules": "Rules",
  "groups.yourBalance": "Your balance",
  "groups.shouldReceive": "You should receive money",
  "groups.shouldPay": "You should pay this",
  "groups.addExpense": "Add expense",
  "groups.settleUp": "Settle up",
  "groups.gone": "This group no longer exists",

  "split.newExpense": "New expense",
  "split.amount": "Amount",
  "split.what": "What was it?",
  "split.paidBy": "Paid by",
  "split.splitBetween": "Split between",
  "split.howToSplit": "How to split",
  "split.equal": "Split equally",
  "split.percentage": "Percentage",
  "split.shares": "Shares",
  "split.exact": "Exact amounts",
  "split.scan": "Scan receipt",
  "split.review": "Review receipt",
  "split.items": "Items",
  "split.result": "Split created",

  "scan.addPhoto": "Add a photo of the receipt",
  "scan.addPhotoHint": "Take a new photo or choose one from your library.",
  "scan.reading": "Reading receipt…",
  "scan.readingHint": "Finding merchant, total and items.",
  "scan.looksGood": "Looks good?",
  "scan.looksGoodHint": "Make sure the total and the lines are readable.",
  "scan.take": "Take photo",
  "scan.choose": "Choose photo",
  "scan.retake": "Retake photo",
  "scan.another": "Choose another photo",
  "scan.read": "Read receipt",
  "scan.failed": "We couldn't read that receipt. Try another photo.",
  "scan.notImage": "That file isn't an image. Choose a photo of the receipt.",

  "activity.title": "Activity",
  "activity.empty": "Nothing has happened yet",
  "activity.emptyHint": "Expenses and settlements show up here.",
  "activity.expenseAdded": "{actor} added {title}",
  "activity.expenseUpdated": "{actor} edited {title}",
  "activity.expenseDeleted": "{actor} deleted {title}",
  "activity.splitChanged": "{actor} changed the split for {title}",
  "activity.settlementMarked": "{actor} marked a settlement",
  "activity.groupCreated": "{actor} created {title}",

  "expense.title": "Expense",
  "expense.total": "Total",
  "expense.date": "Date",
  "expense.group": "Group",
  "expense.split": "Split",
  "expense.receiptItems": "Receipt items",
  "expense.deleteConfirm": "Delete this expense?",
  "expense.deleteHint": "Balances update straight away. This can't be undone.",
  "expense.deleted": "Expense deleted",
  "expense.saved": "Expense updated",
  "expense.gone": "This expense no longer exists",

  "profile.title": "Profile",
  "profile.overall": "Overall",
  "profile.youAreOwed": "You're owed",
  "profile.youOwe": "You owe",
  "profile.settings": "Settings",
  "profile.name": "Your name",
  "profile.language": "Language",
  "profile.currency": "Currency",
  "profile.appearance": "Appearance",
  "profile.people": "People",
  "profile.addPerson": "Add person",
  "profile.howItWorks": "How PARI works",
  "profile.signOut": "Sign out",
  "profile.system": "System",
  "profile.light": "Light",
  "profile.dark": "Dark",

  "auth.title": "Welcome to PARI",
  "auth.subtitle": "Share anything. Settle easily.",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.signIn": "Sign in",
  "auth.signUp": "Create account",
  "auth.google": "Continue with Google",
  "auth.toSignUp": "New here? Create an account",
  "auth.toSignIn": "Already have an account? Sign in",
  "auth.checkEmail": "Check your email to confirm your account.",
};

const da: Dict = {
  "app.tagline": "Del alt. Gør op med et tryk.",
  "nav.home": "Hjem",
  "nav.groups": "Grupper",
  "nav.split": "Del",
  "nav.activity": "Aktivitet",
  "nav.profile": "Profil",

  "greeting.morning": "Godmorgen, {name}",
  "greeting.afternoon": "God eftermiddag, {name}",
  "greeting.evening": "Godaften, {name}",

  "common.back": "Tilbage",
  "common.cancel": "Annullér",
  "common.save": "Gem",
  "common.done": "Færdig",
  "common.delete": "Slet",
  "common.edit": "Redigér",
  "common.close": "Luk",
  "common.continue": "Fortsæt",
  "common.selectAll": "Vælg alle",
  "common.deselectAll": "Fravælg alle",
  "common.today": "I dag",
  "common.yesterday": "I går",
  "common.loading": "Henter…",
  "common.you": "Dig",
  "common.unknown": "Ukendt",
  "common.people": "personer",
  "common.members": "medlemmer",

  "balance.owed": "Du har til gode",
  "balance.owe": "Du skylder",
  "balance.settled": "Gjort op",
  "balance.allSettled": "Alt er gjort op",
  "common.memberCount": "{count} medlemmer",

  "home.settled": "Alt er gjort op.",
  "home.acrossGroups": "På tværs af {count} grupper",
  "home.yourGroups": "Dine grupper",
  "home.seeAll": "Se alle",
  "home.recent": "Seneste",
  "home.noExpenses": "Ingen delte udgifter endnu",
  "home.noExpensesHint": "Del din første udgift på få sekunder.",
  "home.paidBy": "Betalt af {name}",

  "groups.title": "Grupper",
  "groups.create": "Opret gruppe",
  "groups.none": "Ingen grupper endnu",
  "groups.noneHint": "En gruppe holder én samlet balance for dem, du deler med.",
  "groups.expenses": "Udgifter",
  "groups.people": "Personer",
  "groups.rules": "Regler",
  "groups.yourBalance": "Din balance",
  "groups.shouldReceive": "Du skal have penge",
  "groups.shouldPay": "Du skal betale",
  "groups.addExpense": "Tilføj udgift",
  "groups.settleUp": "Gør op",
  "groups.gone": "Denne gruppe findes ikke længere",

  "split.newExpense": "Ny udgift",
  "split.amount": "Beløb",
  "split.what": "Hvad var det?",
  "split.paidBy": "Betalt af",
  "split.splitBetween": "Deles mellem",
  "split.howToSplit": "Sådan deles det",
  "split.equal": "Del ligeligt",
  "split.percentage": "Procent",
  "split.shares": "Andele",
  "split.exact": "Præcise beløb",
  "split.scan": "Scan kvittering",
  "split.review": "Gennemse kvittering",
  "split.items": "Varer",
  "split.result": "Delt",

  "scan.addPhoto": "Tilføj et billede af kvitteringen",
  "scan.addPhotoHint": "Tag et nyt billede eller vælg et fra dit bibliotek.",
  "scan.reading": "Læser kvittering…",
  "scan.readingHint": "Finder butik, total og varer.",
  "scan.looksGood": "Ser det godt ud?",
  "scan.looksGoodHint": "Sørg for at total og varelinjer kan læses.",
  "scan.take": "Tag billede",
  "scan.choose": "Vælg billede",
  "scan.retake": "Tag nyt billede",
  "scan.another": "Vælg et andet billede",
  "scan.read": "Læs kvittering",
  "scan.failed": "Vi kunne ikke læse kvitteringen. Prøv et andet billede.",
  "scan.notImage": "Filen er ikke et billede. Vælg et foto af kvitteringen.",

  "activity.title": "Aktivitet",
  "activity.empty": "Der er ikke sket noget endnu",
  "activity.emptyHint": "Udgifter og opgør vises her.",
  "activity.expenseAdded": "{actor} tilføjede {title}",
  "activity.expenseUpdated": "{actor} redigerede {title}",
  "activity.expenseDeleted": "{actor} slettede {title}",
  "activity.splitChanged": "{actor} ændrede fordelingen for {title}",
  "activity.settlementMarked": "{actor} markerede et opgør",
  "activity.groupCreated": "{actor} oprettede {title}",

  "expense.title": "Udgift",
  "expense.total": "Total",
  "expense.date": "Dato",
  "expense.group": "Gruppe",
  "expense.split": "Fordeling",
  "expense.receiptItems": "Varer på kvitteringen",
  "expense.deleteConfirm": "Slet denne udgift?",
  "expense.deleteHint": "Balancerne opdateres med det samme. Det kan ikke fortrydes.",
  "expense.deleted": "Udgift slettet",
  "expense.saved": "Udgift opdateret",
  "expense.gone": "Denne udgift findes ikke længere",

  "profile.title": "Profil",
  "profile.overall": "Samlet",
  "profile.youAreOwed": "Du har til gode",
  "profile.youOwe": "Du skylder",
  "profile.settings": "Indstillinger",
  "profile.name": "Dit navn",
  "profile.language": "Sprog",
  "profile.currency": "Valuta",
  "profile.appearance": "Udseende",
  "profile.people": "Personer",
  "profile.addPerson": "Tilføj person",
  "profile.howItWorks": "Sådan virker PARI",
  "profile.signOut": "Log ud",
  "profile.system": "System",
  "profile.light": "Lys",
  "profile.dark": "Mørk",

  "auth.title": "Velkommen til PARI",
  "auth.subtitle": "Del alt. Gør op med et tryk.",
  "auth.email": "E-mail",
  "auth.password": "Adgangskode",
  "auth.signIn": "Log ind",
  "auth.signUp": "Opret konto",
  "auth.google": "Fortsæt med Google",
  "auth.toSignUp": "Ny her? Opret en konto",
  "auth.toSignIn": "Har du allerede en konto? Log ind",
  "auth.checkEmail": "Tjek din mail for at bekræfte kontoen.",
};

const DICTS: Record<Language, Dict> = { en, da };

export type Translate = (key: string, vars?: Record<string, string | number>) => string;

type I18nValue = { language: Language; t: Translate; locale: string };

const I18nContext = createContext<I18nValue | null>(null);

export function detectLanguage(): Language {
  if (typeof navigator === "undefined") return "da";
  return navigator.language?.toLowerCase().startsWith("da") ? "da" : "en";
}

export function I18nProvider({
  language,
  children,
}: {
  language: Language;
  children: ReactNode;
}) {
  const value = useMemo<I18nValue>(() => {
    const dict = DICTS[language] ?? da;
    const t: Translate = (key, vars) => {
      let text = dict[key] ?? en[key] ?? key;
      if (vars) {
        for (const [name, replacement] of Object.entries(vars)) {
          text = text.replaceAll(`{${name}}`, String(replacement));
        }
      }
      return text;
    };
    return { language, t, locale: language === "da" ? "da-DK" : "en-GB" };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) return { language: "da", t: (key) => da[key] ?? key, locale: "da-DK" };
  return context;
}

export function useT(): Translate {
  return useI18n().t;
}
