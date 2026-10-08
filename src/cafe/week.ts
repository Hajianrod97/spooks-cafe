/** Minutes as hours with at most one decimal: 90 → 1.5. */
export const hours = (minutes: number) => +(minutes / 60).toFixed(1);

/** "Mon 5 Oct – Sun 11 Oct" in the user's locale for the week containing `day`. Weeks start Monday, like the Rust queries. */
export function weekLabel(day: Date) {
  const monday = new Date(day);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const format = (d: Date) => d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  return `${format(monday)} – ${format(sunday)}`;
}
