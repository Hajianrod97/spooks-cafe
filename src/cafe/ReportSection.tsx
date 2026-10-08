import { useState } from "react";
import type { Phase, Todo, TrendsReport, WeekReport } from "../types";
import { useReport } from "../useReport";
import { TrendsView } from "./TrendsView";
import { WeekView } from "./WeekView";
import { weekLabel } from "./week";

type View = "week" | "trends";

// Like the board's tab, a per-window convenience: localStorage, and fine to lose.
const STORAGE_KEY = "report-view";

function savedView(): View {
  try {
    return localStorage.getItem(STORAGE_KEY) === "trends" ? "trends" : "week";
  } catch {
    return "week";
  }
}

interface Props {
  phase: Phase;
  todos: Todo[];
  onSessions: () => void;
}

/** The board's report: Week (one week at a time) or Trends (over time). Read-only. */
export function ReportSection({ phase, todos, onSessions }: Props) {
  const [view, setView] = useState<View>(savedView);
  // Not remembered: the report always opens on this week.
  const [weeksAgo, setWeeksAgo] = useState(0);
  const { report, error: weekError } = useReport<WeekReport>("report_week", { weeksAgo }, phase, todos);
  const { report: trends, error: trendsError } = useReport<TrendsReport>("report_trends", {}, phase, todos);
  const error = view === "week" ? weekError : trendsError;

  function show(next: View) {
    setView(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not remembered this time.
    }
  }

  return (
    <div className="report">
      {view === "week" ? (
        <div className="status week-nav">
          <button
            className="step"
            aria-label="Previous week"
            disabled={!report?.hasEarlier}
            onClick={() => setWeeksAgo((w) => w + 1)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 5-7 7 7 7" />
            </svg>
          </button>
          <span aria-live="polite">{report ? weekLabel(new Date(report.weekStart * 1000)) : " "}</span>
          <button className="step" aria-label="Next week" disabled={weeksAgo === 0} onClick={() => setWeeksAgo((w) => w - 1)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 5 7 7-7 7" />
            </svg>
          </button>
          {weeksAgo > 0 && (
            <button className="chalk-link" onClick={() => setWeeksAgo(0)}>
              This week
            </button>
          )}
        </div>
      ) : (
        <p className="status">Last 16 weeks</p>
      )}

      <fieldset className="chalk-switch views">
        <legend className="visually-hidden">Report view</legend>
        <label>
          <input type="radio" name="report-view" className="visually-hidden" checked={view === "week"} onChange={() => show("week")} />
          Week
        </label>
        <label>
          <input type="radio" name="report-view" className="visually-hidden" checked={view === "trends"} onChange={() => show("trends")} />
          Trends
        </label>
      </fieldset>

      {error && <p className="error">{error}</p>}

      {view === "week" ? (
        report && <WeekView report={report} isThisWeek={weeksAgo === 0} onSessions={onSessions} />
      ) : (
        trends && <TrendsView report={trends} />
      )}
    </div>
  );
}
