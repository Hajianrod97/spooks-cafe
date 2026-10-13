import { useRef, useState, type KeyboardEvent } from "react";
import type { Phase } from "../types";
import { useTodos } from "../useTodos";
import { MenuSection, type MenuProps } from "./MenuSection";
import { ReportSection } from "./ReportSection";
import { TodoList } from "./TodoList";
import "./menu.css";

const SECTIONS = [
  { id: "menu", label: "Menu" },
  { id: "todo", label: "To-do" },
  { id: "report", label: "Report" },
] as const;
type Section = (typeof SECTIONS)[number]["id"];

// Which tab was open is a convenience for this window only, so it lives in localStorage
// rather than the database. Storage can be unavailable; the board then just opens on Menu.
const STORAGE_KEY = "chalkboard-section";

function savedSection(): Section {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return SECTIONS.find((s) => s.id === saved)?.id ?? "menu";
  } catch {
    return "menu";
  }
}

/** The chalkboard under the scene: chalk tabs over one section at a time. Only the user switches. */
interface Props extends MenuProps {
  /** Report refetches when it changes, since that's when blocks get logged. */
  phase: Phase;
  /** For the To-do status line, once today's to-do beans are used up. */
  todoBeansLeft: number | undefined;
}

export function Chalkboard({ phase, todoBeansLeft, ...menu }: Props) {
  const [section, setSection] = useState<Section>(savedSection);
  // Owned here rather than by the section, so switching tabs doesn't refetch or flash an empty list.
  const todos = useTodos();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  function show(next: Section) {
    setSection(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not remembered this time; nothing else depends on it.
    }
  }

  // The tab pattern: arrows move between tabs (wrapping) and switch straight away; Home/End jump to the ends.
  function onKeyDown(e: KeyboardEvent) {
    const i = SECTIONS.findIndex((s) => s.id === section);
    const n = SECTIONS.length;
    const to = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    show(SECTIONS[to].id);
    tabs.current[to]?.focus();
  }

  return (
    <section className="chalkboard" aria-label="Chalkboard">
      <div className="board">
        <div className="tabs" role="tablist" aria-label="Chalkboard sections" onKeyDown={onKeyDown}>
          {SECTIONS.map(({ id, label }, i) => (
            <button
              key={id}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              id={`tab-${id}`}
              role="tab"
              aria-selected={section === id}
              aria-controls={`panel-${id}`}
              tabIndex={section === id ? 0 : -1}
              onClick={() => show(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Keyed by section so each switch remounts the panel and replays the fade. */}
        <div
          key={section}
          className="board-section"
          id={`panel-${section}`}
          role="tabpanel"
          aria-labelledby={`tab-${section}`}
        >
          {section === "menu" && <MenuSection {...menu} />}
          {section === "todo" && <TodoList tasks={menu.tasks} todos={todos} beansMaxed={todoBeansLeft === 0} />}
          {section === "report" && <ReportSection phase={phase} todos={todos.todos} onSessions={menu.onSessions} />}
        </div>
      </div>
    </section>
  );
}
