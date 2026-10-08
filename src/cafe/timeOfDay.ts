import { useEffect, useState } from "react";

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

/** Fixed boundaries for now; 6b makes them adjustable in settings. */
export function timeOfDay(date: Date): TimeOfDay {
  const hour = date.getHours();
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 20) return "evening";
  return "night";
}

/** The current time of day, rechecked every minute. */
export function useTimeOfDay() {
  const [time, setTime] = useState(() => timeOfDay(new Date()));
  useEffect(() => {
    const id = setInterval(() => setTime(timeOfDay(new Date())), 60_000);
    return () => clearInterval(id);
  }, []);
  return time;
}
