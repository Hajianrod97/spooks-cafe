import { useEffect, useState } from "react";
import type { Settings, TimeOfDay } from "../types";

type DayStarts = Pick<Settings, "morningStart" | "afternoonStart" | "eveningStart" | "nightStart">;

/** The defaults in migration 006, used until settings have loaded. */
const DEFAULT_STARTS: DayStarts = { morningStart: 6, afternoonStart: 12, eveningStart: 17, nightStart: 20 };

/** Each phase runs until the next starts; night also covers the small hours before morning. */
export function timeOfDay(date: Date, starts: DayStarts): TimeOfDay {
  const hour = date.getHours();
  if (hour >= starts.nightStart || hour < starts.morningStart) return "night";
  if (hour >= starts.eveningStart) return "evening";
  if (hour >= starts.afternoonStart) return "afternoon";
  return "morning";
}

/** The time of day the scene shows: pinned in settings, or the clock's, rechecked every minute. */
export function useTimeOfDay(settings: Settings | null): TimeOfDay {
  const { morningStart, afternoonStart, eveningStart, nightStart } = settings ?? DEFAULT_STARTS;
  const [clockTime, setClockTime] = useState(() =>
    timeOfDay(new Date(), { morningStart, afternoonStart, eveningStart, nightStart }),
  );

  // Re-runs when the hours change too, so a save in settings shows at once, not a minute later.
  useEffect(() => {
    const starts = { morningStart, afternoonStart, eveningStart, nightStart };
    const update = () => setClockTime(timeOfDay(new Date(), starts));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [morningStart, afternoonStart, eveningStart, nightStart]);

  const pinned = settings?.sceneTime;
  return pinned && pinned !== "auto" ? pinned : clockTime;
}
