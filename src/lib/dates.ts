import { format, isThisYear, isToday, isYesterday } from "date-fns";

export function shortDate(iso: string) {
  const date = new Date(iso);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, isThisYear(date) ? "d MMM" : "d MMM yyyy");
}

export function dayGroupLabel(iso: string) {
  const date = new Date(iso);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, isThisYear(date) ? "EEEE d MMMM" : "d MMMM yyyy");
}

export function timeOfDayGreeting(name: string) {
  const hour = new Date().getHours();
  if (hour < 11) return `Good morning, ${name}`;
  if (hour < 17) return `Good afternoon, ${name}`;
  return `Good evening, ${name}`;
}
