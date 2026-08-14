import { format, isThisYear, isToday, isYesterday } from "date-fns";
import { da as daLocale, enGB } from "date-fns/locale";

type Lang = "da" | "en";

let language: Lang = "da";

export function setDateLanguage(next: Lang) {
  language = next;
}

const LABELS: Record<Lang, { today: string; yesterday: string }> = {
  da: { today: "I dag", yesterday: "I går" },
  en: { today: "Today", yesterday: "Yesterday" },
};

const locale = () => (language === "da" ? daLocale : enGB);

export function shortDate(iso: string) {
  const date = new Date(iso);
  if (isToday(date)) return LABELS[language].today;
  if (isYesterday(date)) return LABELS[language].yesterday;
  return format(date, isThisYear(date) ? "d MMM" : "d MMM yyyy", { locale: locale() });
}

export function dayGroupLabel(iso: string) {
  const date = new Date(iso);
  if (isToday(date)) return LABELS[language].today;
  if (isYesterday(date)) return LABELS[language].yesterday;
  return format(date, isThisYear(date) ? "EEEE d MMMM" : "d MMMM yyyy", { locale: locale() });
}

export function timeOfDayGreeting(name: string) {
  const hour = new Date().getHours();
  const key = hour < 11 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const da = { morning: "Godmorgen", afternoon: "God eftermiddag", evening: "Godaften" };
  const en = { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening" };
  const prefix = (language === "da" ? da : en)[key];
  return `${prefix}, ${name}`;
}
