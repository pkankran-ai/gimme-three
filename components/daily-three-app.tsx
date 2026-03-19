"use client";

import { ChangeEvent, KeyboardEvent, ReactNode, useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  buildExportPayload,
  canPromotePendingToToday,
  countCompletedTasks,
  createDayEntry,
  DEFAULT_SETTINGS,
  findFirstEmptyTaskIndex,
  formatDisplayDate,
  getAppStats,
  getArchiveGroups,
  getDateKey,
  getHeatmapDays,
  getLast7DaysChart,
  isDayComplete,
  parseImportPayload,
  taskAlreadyExists
} from "@/lib/daily-three";
import { LocalStorageAdapter } from "@/lib/storage";
import { AppData, AppSettings, ArchiveGroup, DayEntry, PendingTask, Task } from "@/lib/types";

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const celebrationDots = [
  { left: "10%", delay: "0ms" },
  { left: "24%", delay: "60ms" },
  { left: "36%", delay: "120ms" },
  { left: "49%", delay: "180ms" },
  { left: "63%", delay: "240ms" },
  { left: "77%", delay: "300ms" },
  { left: "90%", delay: "360ms" }
];

type Notice = {
  tone: "success" | "error";
  text: string;
} | null;

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16" fill="none">
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16" fill="none">
      <path d="M8 2.5V10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
      <path
        d="m5.25 7.75 2.75 2.75 2.75-2.75"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path d="M3 13.25h10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16" fill="none">
      <path d="M8 13.5V6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
      <path
        d="m10.75 8.25-2.75-2.75-2.75 2.75"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path d="M3 2.75h10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16" fill="none">
      <path
        d="M6.75 2.5h6.75M2.5 2.5h1.75M9.75 8h3.75M2.5 8h4.25M4.75 13.5h8.5M2.5 13.5h.75"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
      <circle cx="5.5" cy="2.5" r="1.25" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8.5" cy="8" r="1.25" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="3.25" cy="13.5" r="1.25" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ThemeIcon({ dark }: { dark: boolean }) {
  return dark ? (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16" fill="none">
      <path
        d="M11.75 10.75A5.75 5.75 0 0 1 5.25 4.25a5.75 5.75 0 1 0 6.5 6.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  ) : (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2.75" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 1.75v1.5M8 12.75v1.5M14.25 8h-1.5M3.25 8h-1.5M12.42 3.58l-1.06 1.06M4.64 11.36l-1.06 1.06M12.42 12.42l-1.06-1.06M4.64 4.64 3.58 3.58"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function ActionButton({
  children,
  onClick,
  variant = "ghost",
  disabled = false
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "ghost" | "primary" | "soft" | "danger";
  disabled?: boolean;
}) {
  const className =
    variant === "primary"
      ? "button-primary"
      : variant === "soft"
        ? "button-soft"
        : variant === "danger"
          ? "button-danger"
          : "button-ghost";

  return (
    <button className={className} disabled={disabled} onClick={onClick} type="button">
      {children}
    </button>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onToggle
}: {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className="surface-subtle flex w-full items-center justify-between gap-4 rounded-[22px] px-4 py-4 text-left transition hover:-translate-y-0.5"
      onClick={onToggle}
      type="button"
    >
      <div>
        <p className="text-sm font-semibold text-[color:var(--foreground)]">{label}</p>
        <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">{description}</p>
      </div>
      <span className={`switch-track ${checked ? "switch-track-on" : ""}`} aria-hidden="true">
        <span className={`switch-thumb ${checked ? "switch-thumb-on" : ""}`} />
      </span>
    </button>
  );
}

function MetricCard({
  label,
  value,
  note,
  tone
}: {
  label: string;
  value: string;
  note: string;
  tone: "success" | "warning" | "neutral";
}) {
  const toneClass =
    tone === "success"
      ? "text-[color:var(--success)]"
      : tone === "warning"
        ? "text-[color:var(--warning)]"
        : "text-[color:var(--foreground)]";

  return (
    <div className="card-surface metric-glow rounded-[30px] p-5 md:p-6">
      <p className="text-[11px] uppercase tracking-[0.32em] text-[color:var(--muted)]">{label}</p>
      <p className={`mt-4 text-4xl font-bold md:text-5xl ${toneClass}`}>{value}</p>
      <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">{note}</p>
    </div>
  );
}

function TaskRow({
  task,
  index,
  inputRef,
  onTextChange,
  onToggle,
  onKeyDown
}: {
  task: Task;
  index: number;
  inputRef: (node: HTMLInputElement | null) => void;
  onTextChange: (index: number, value: string) => void;
  onToggle: (index: number) => void;
  onKeyDown: (index: number, event: KeyboardEvent<HTMLInputElement>) => void;
}) {
  const isFilled = Boolean(task.text.trim());

  return (
    <div className={`task-ring rounded-[26px] p-4 md:p-5 ${task.completed ? "task-complete" : ""}`}>
      <div className="flex items-start gap-4">
        <button
          aria-label={`Toggle task ${index + 1}`}
          className={`task-check ${task.completed ? "task-check-on" : ""}`}
          onClick={() => onToggle(index)}
          type="button"
        >
          <CheckIcon />
        </button>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[11px] uppercase tracking-[0.28em] text-[color:var(--muted)]">
              Slot 0{index + 1}
            </span>
            {task.carriedFromDate ? (
              <span className="warning-pill">
                Carried from {formatDisplayDate(task.carriedFromDate, { month: "short", day: "numeric" })}
              </span>
            ) : null}
          </div>
          <input
            className={`w-full border-0 bg-transparent p-0 text-lg outline-none placeholder:text-[color:var(--placeholder)] md:text-xl ${
              task.completed ? "text-[color:var(--muted)] line-through" : "text-[color:var(--foreground)]"
            }`}
            maxLength={120}
            onChange={(event) => onTextChange(index, event.target.value)}
            onKeyDown={(event) => onKeyDown(index, event)}
            placeholder="Write the non-negotiable."
            ref={inputRef}
            value={task.text}
          />
          <p className="mt-3 text-xs uppercase tracking-[0.22em] text-[color:var(--soft)]">
            {isFilled ? (task.completed ? "Completed" : "In progress") : "Ready for focus"}
          </p>
        </div>
      </div>
    </div>
  );
}

function ChartTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: Array<{ value?: number; payload?: { date: string; completed: number } }>;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload;
  if (!point) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-[color:var(--foreground)]">{formatDisplayDate(point.date)}</p>
      <p className="mt-1 text-[color:var(--muted)]">{point.completed} of 3 completed</p>
    </div>
  );
}

function PendingList({
  pending,
  today,
  onPromote,
  onDelete
}: {
  pending: PendingTask[];
  today: DayEntry;
  onPromote: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}) {
  const canAdd = canPromotePendingToToday(today);
  const openSlots = today.tasks.filter((task) => !task.text.trim()).length;

  return (
    <div className="card-surface rounded-[30px] p-6 md:p-7">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-[color:var(--muted)]">Carryovers</p>
          <h2 className="mt-3 text-3xl font-semibold text-[color:var(--foreground)]">Pending</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[color:var(--muted)]">
            Review unfinished promises before you let them quietly disappear.
          </p>
        </div>
        <div className="surface-subtle rounded-[22px] px-4 py-3 text-sm text-[color:var(--muted)]">
          {canAdd ? `${openSlots} open ${openSlots === 1 ? "slot" : "slots"} today` : "Today is already full"}
        </div>
      </div>
      {pending.length ? (
        <div className="mt-6 space-y-3">
          {pending.map((task) => (
            <div className="surface-subtle rounded-[24px] p-4 md:p-5" key={task.id}>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-[color:var(--foreground)]">{task.text}</p>
                  <p className="mt-2 text-sm text-[color:var(--muted)]">
                    Started on {formatDisplayDate(task.sourceDate, { month: "long", day: "numeric", year: "numeric" })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ActionButton
                    disabled={!canAdd}
                    onClick={() => onPromote(task.id)}
                    variant={canAdd ? "primary" : "soft"}
                  >
                    Add to today
                  </ActionButton>
                  <ActionButton onClick={() => onDelete(task.id)} variant="ghost">
                    Delete
                  </ActionButton>
                </div>
              </div>
            </div>
          ))}
          {!canAdd ? (
            <p className="rounded-[18px] bg-[color:var(--warning-soft)] px-4 py-3 text-sm text-[color:var(--warning)]">
              Today already has all three slots filled. Clear an empty slot before pulling a pending task in.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="empty-state mt-6 rounded-[26px] p-6 md:p-8">
          <p className="text-lg font-semibold text-[color:var(--foreground)]">No carryovers today.</p>
          <p className="mt-3 max-w-lg text-sm leading-6 text-[color:var(--muted)]">
            A clean slate. When a day rolls over, any unfinished non-empty task will appear here for review.
          </p>
        </div>
      )}
    </div>
  );
}

function ArchivePanel({ groups }: { groups: ArchiveGroup[] }) {
  return (
    <div className="card-surface rounded-[30px] p-6 md:p-7">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-[color:var(--muted)]">History</p>
          <h2 className="mt-3 text-3xl font-semibold text-[color:var(--foreground)]">Archive</h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
            Every day stays visible, grouped by month so it is easier to scan your follow-through.
          </p>
        </div>
        <div className="surface-subtle rounded-[22px] px-4 py-3 text-sm text-[color:var(--muted)]">
          {groups.reduce((total, group) => total + group.days.length, 0)} saved days
        </div>
      </div>

      {groups.length ? (
        <div className="mt-6 max-h-[460px] space-y-6 overflow-y-auto pr-1 scroll-thin">
          {groups.map((group) => (
            <section key={group.label}>
              <div className="mb-3 flex items-center gap-3">
                <h3 className="text-lg font-semibold text-[color:var(--foreground)]">{group.label}</h3>
                <div className="h-px flex-1 bg-[color:var(--border)]" />
              </div>
              <div className="space-y-3">
                {group.days.map((day) => {
                  const completed = countCompletedTasks(day);
                  const perfect = completed === 3;

                  return (
                    <div className="surface-subtle rounded-[24px] p-4 md:p-5" key={day.date}>
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-lg font-semibold text-[color:var(--foreground)]">
                            {formatDisplayDate(day.date)}
                          </p>
                          <p className="mt-1 text-sm text-[color:var(--muted)]">{completed}/3 completed</p>
                        </div>
                        <span className={perfect ? "success-pill" : "warning-pill"}>
                          {perfect ? "Full clear" : "Needs attention"}
                        </span>
                      </div>
                      <div className="mt-4 space-y-2">
                        {day.tasks.map((task) => (
                          <div
                            className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm ${
                              task.completed
                                ? "border-[color:var(--success-soft)] bg-[color:var(--success-soft)] text-[color:var(--foreground)]"
                                : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--muted)]"
                            }`}
                            key={task.id}
                          >
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                                task.completed
                                  ? "border-[color:var(--success)] bg-[color:var(--success)] text-white"
                                  : "border-[color:var(--border-strong)] text-[color:var(--muted)]"
                              }`}
                            >
                              <CheckIcon />
                            </span>
                            <span>{task.text.trim() ? task.text : "Empty slot"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="empty-state mt-6 rounded-[26px] p-6 md:p-8">
          <p className="text-lg font-semibold text-[color:var(--foreground)]">No archive yet.</p>
          <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
            Once a new day starts, your previous days will appear here with a quick completion summary.
          </p>
        </div>
      )}
    </div>
  );
}

export function DailyThreeApp() {
  const adapterRef = useRef(new LocalStorageAdapter());
  const taskInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const initialFocusDoneRef = useRef(false);
  const previousCompletionRef = useRef(false);

  const [data, setData] = useState<AppData | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isHydrated, setIsHydrated] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);

  useEffect(() => {
    const nextData = adapterRef.current.load();
    const nextSettings = adapterRef.current.loadSettings();

    setData(nextData);
    setSettings(nextSettings);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated || !data) {
      return;
    }

    adapterRef.current.save(data);
  }, [data, isHydrated]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    adapterRef.current.saveSettings(settings);
    document.documentElement.dataset.theme = settings.darkMode ? "dark" : "light";
  }, [isHydrated, settings]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setNotice(null);
    }, 4000);

    return () => window.clearTimeout(timeout);
  }, [notice]);

  const todayKey = getDateKey();
  const today = data?.days[todayKey] ?? createDayEntry(todayKey);
  const stats = data
    ? getAppStats(data, todayKey)
    : {
        currentStreak: 0,
        bestStreak: 0,
        completionRate: 0,
        totalTasksCompleted: 0
      };
  const chartData = data ? getLast7DaysChart(data, todayKey) : [];
  const heatmapDays = data ? getHeatmapDays(data, todayKey) : [];
  const archiveGroups = data ? getArchiveGroups(data, todayKey) : [];
  const completionToday = countCompletedTasks(today);
  const firstEmptyIndex = findFirstEmptyTaskIndex(today);
  const todayComplete = isDayComplete(today);
  const openSlots = today.tasks.filter((task) => !task.text.trim()).length;

  useEffect(() => {
    if (!data) {
      return;
    }

    if (!isHydrated || initialFocusDoneRef.current) {
      return;
    }

    if (firstEmptyIndex === -1) {
      initialFocusDoneRef.current = true;
      return;
    }

    const timeout = window.setTimeout(() => {
      taskInputRefs.current[firstEmptyIndex]?.focus();
      initialFocusDoneRef.current = true;
    }, 60);

    return () => window.clearTimeout(timeout);
  }, [firstEmptyIndex, isHydrated]);

  useEffect(() => {
    if (!data) {
      return;
    }

    if (!settings.celebrationsEnabled) {
      setIsCelebrating(false);
      previousCompletionRef.current = todayComplete;
      return;
    }

    if (todayComplete && !previousCompletionRef.current) {
      setIsCelebrating(true);
      const timeout = window.setTimeout(() => {
        setIsCelebrating(false);
      }, 1600);

      previousCompletionRef.current = true;
      return () => window.clearTimeout(timeout);
    }

    previousCompletionRef.current = todayComplete;
  }, [settings.celebrationsEnabled, todayComplete, todayKey]);

  const focusTask = (index: number) => {
    const input = taskInputRefs.current[index];
    if (!input) {
      return;
    }

    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  };

  const updateToday = (updater: (day: DayEntry) => DayEntry) => {
    setData((current) => {
      if (!current) {
        return current;
      }

      const currentDay = current.days[todayKey] ?? createDayEntry(todayKey);
      const nextDay = updater(currentDay);

      return {
        ...current,
        days: {
          ...current.days,
          [todayKey]: nextDay
        },
        pending: current.pending.filter((pendingTask) => !taskAlreadyExists(nextDay, pendingTask.text))
      };
    });
  };

  const handleTaskTextChange = (index: number, value: string) => {
    updateToday((day) => {
      const tasks = [...day.tasks] as Task[];
      tasks[index] = {
        ...tasks[index],
        text: value,
        completed: value.trim() ? tasks[index].completed : false
      };
      return createDayEntry(day.date, tasks);
    });
  };

  const handleToggleTask = (index: number) => {
    updateToday((day) => {
      const tasks = [...day.tasks] as Task[];
      const task = tasks[index];

      if (!task.text.trim()) {
        return day;
      }

      tasks[index] = {
        ...task,
        completed: !task.completed
      };

      return createDayEntry(day.date, tasks);
    });
  };

  const handleTaskKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (index < 2) {
        focusTask(index + 1);
      } else {
        event.currentTarget.blur();
      }
      return;
    }

    if (
      event.key === "Backspace" &&
      !event.currentTarget.value &&
      event.currentTarget.selectionStart === 0 &&
      event.currentTarget.selectionEnd === 0 &&
      index > 0
    ) {
      event.preventDefault();
      focusTask(index - 1);
    }
  };

  const handlePromotePending = (taskId: string) => {
    setData((current) => {
      if (!current) {
        return current;
      }

      const pendingTask = current.pending.find((item) => item.id === taskId);
      const currentDay = current.days[todayKey] ?? createDayEntry(todayKey);

      if (!pendingTask) {
        return current;
      }

      if (taskAlreadyExists(currentDay, pendingTask.text)) {
        setNotice({
          tone: "success",
          text: "That pending task already exists in today's list, so it was removed from pending."
        });

        return {
          ...current,
          pending: current.pending.filter((item) => item.id !== taskId)
        };
      }

      const emptyIndex = currentDay.tasks.findIndex((task) => !task.text.trim());
      if (emptyIndex === -1) {
        setNotice({
          tone: "error",
          text: "Today is already full. Clear an empty slot before adding another task."
        });
        return current;
      }

      const tasks = [...currentDay.tasks] as Task[];
      tasks[emptyIndex] = {
        id: tasks[emptyIndex].id,
        text: pendingTask.text,
        completed: false,
        carriedFromDate: pendingTask.sourceDate
      };

      window.setTimeout(() => {
        focusTask(emptyIndex);
      }, 40);

      setNotice({
        tone: "success",
        text: "Pending task added back into today."
      });

      return {
        ...current,
        days: {
          ...current.days,
          [todayKey]: createDayEntry(todayKey, tasks)
        },
        pending: current.pending.filter((item) => item.id !== taskId)
      };
    });
  };

  const handleDeletePending = (taskId: string) => {
    setData((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        pending: current.pending.filter((item) => item.id !== taskId)
      };
    });

    setNotice({
      tone: "success",
      text: "Pending task deleted."
    });
  };

  const handleExport = () => {
    if (!data) {
      return;
    }

    const json = buildExportPayload(data, settings);
    const blob = new Blob([json], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `daily-three-backup-${todayKey}.json`;
    link.click();
    window.URL.revokeObjectURL(url);

    setNotice({
      tone: "success",
      text: "Backup exported as JSON."
    });
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const imported = parseImportPayload(text, todayKey);
      setData(imported.data);
      setSettings(imported.settings);
      setNotice({
        tone: "success",
        text: "Backup imported successfully."
      });
      initialFocusDoneRef.current = false;
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Unable to import that backup file."
      });
    } finally {
      event.target.value = "";
    }
  };

  const toggleSetting = (key: keyof AppSettings) => {
    setSettings((current) => ({
      ...current,
      [key]: !current[key]
    }));
  };

  if (!data) {
    return (
      <main className="min-h-screen px-4 py-10 md:px-8">
        <div className="mx-auto flex min-h-[80vh] max-w-6xl items-center justify-center">
          <div className="card-surface rounded-[32px] px-8 py-10 text-center">
            <p className="text-[11px] uppercase tracking-[0.3em] text-[color:var(--muted)]">Daily Three</p>
            <h1 className="mt-4 text-4xl font-semibold text-[color:var(--foreground)]">
              Loading your accountability board...
            </h1>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <input
          accept="application/json"
          className="hidden"
          onChange={handleImport}
          ref={importInputRef}
          type="file"
        />

        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.34em] text-[color:var(--muted)]">Daily Three</p>
            <h1 className="mt-3 text-3xl font-semibold text-[color:var(--foreground)] md:text-4xl">
              Keep promises to yourself.
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={handleExport} variant="ghost">
              <DownloadIcon />
              Export JSON
            </ActionButton>
            <ActionButton onClick={() => importInputRef.current?.click()} variant="ghost">
              <UploadIcon />
              Import JSON
            </ActionButton>
            <ActionButton onClick={() => toggleSetting("darkMode")} variant="ghost">
              <ThemeIcon dark={settings.darkMode} />
              {settings.darkMode ? "Light mode" : "Dark mode"}
            </ActionButton>
            <ActionButton onClick={() => setSettingsOpen((current) => !current)} variant="soft">
              <SettingsIcon />
              Settings
            </ActionButton>
          </div>
        </header>

        {notice ? (
          <div className={`status-banner ${notice.tone === "success" ? "status-success" : "status-error"}`}>
            {notice.text}
          </div>
        ) : null}

        {settingsOpen ? (
          <section className="card-surface rounded-[30px] p-6 md:p-7">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.32em] text-[color:var(--muted)]">Preferences</p>
                <h2 className="mt-3 text-3xl font-semibold text-[color:var(--foreground)]">Settings</h2>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                  Everything stays local in your browser. No account, no backend, no sync surprises.
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-3 lg:grid-cols-3">
              <ToggleRow
                checked={settings.celebrationsEnabled}
                description="Show a subtle success state when all three tasks are finished."
                label="Celebration"
                onToggle={() => toggleSetting("celebrationsEnabled")}
              />
              <ToggleRow
                checked={settings.darkMode}
                description="Use a darker palette with stronger contrast for night sessions."
                label="Dark mode"
                onToggle={() => toggleSetting("darkMode")}
              />
              <ToggleRow
                checked={settings.showMotivationalCopy}
                description="Show the extra motivational microcopy in the hero section."
                label="Motivational copy"
                onToggle={() => toggleSetting("showMotivationalCopy")}
              />
            </div>
          </section>
        ) : null}
        <section className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
          <div className="card-surface card-strong relative overflow-hidden rounded-[38px] p-6 md:p-8">
            {isCelebrating ? (
              <div aria-hidden="true" className="celebration-burst">
                {celebrationDots.map((dot) => (
                  <span
                    className="celebration-dot"
                    key={`${dot.left}-${dot.delay}`}
                    style={{ left: dot.left, animationDelay: dot.delay }}
                  />
                ))}
              </div>
            ) : null}

            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] uppercase tracking-[0.34em] text-[color:var(--muted)]">Today</p>
                <h2 className="mt-4 text-4xl font-semibold leading-tight text-[color:var(--foreground)] md:text-6xl">
                  Three promises. One focused day.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-[color:var(--muted)]">
                  Define the three things that make today count, finish them, and let the app quietly keep score.
                </p>
                {settings.showMotivationalCopy ? (
                  <p className="mt-3 text-sm uppercase tracking-[0.22em] text-[color:var(--soft)]">
                    Keep promises to yourself.
                  </p>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:w-[320px] lg:grid-cols-1">
                <div className="surface-subtle rounded-[26px] px-5 py-4">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[color:var(--muted)]">Today</p>
                  <p className="mt-3 text-3xl font-semibold leading-tight text-[color:var(--foreground)]">
                    {formatDisplayDate(todayKey, { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                  <p className="mt-3 text-sm text-[color:var(--muted)]">{completionToday} of 3 complete</p>
                </div>
                <div className="surface-highlight rounded-[26px] px-5 py-4">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[color:var(--muted)]">Current streak</p>
                  <p className="mt-3 text-4xl font-bold text-[color:var(--success)]">{stats.currentStreak}</p>
                  <p className="mt-2 text-sm text-[color:var(--muted)]">
                    {stats.currentStreak > 0 ? "Keep the chain alive." : "Your next clean sweep starts today."}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 rounded-[26px] border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5">
              <div>
                <p className="text-sm font-semibold text-[color:var(--foreground)]">Keyboard-first flow</p>
                <p className="mt-1 text-sm text-[color:var(--muted)]">
                  Press Enter to move forward. Press Backspace on an empty task to move back.
                </p>
              </div>
              <div className="text-sm text-[color:var(--muted)]">
                {openSlots > 0 ? `${openSlots} empty ${openSlots === 1 ? "slot" : "slots"} left` : "All three slots are claimed"}
              </div>
            </div>

            {todayComplete ? (
              <div className="mt-5 rounded-[24px] bg-[color:var(--success-soft)] px-5 py-4 text-[color:var(--foreground)]">
                <p className="text-sm font-semibold">All three are done.</p>
                <p className="mt-1 text-sm text-[color:var(--muted)]">
                  Clean sweep. Take the win and let tomorrow start with momentum.
                </p>
              </div>
            ) : null}

            <div className="mt-6 grid gap-4">
              {today.tasks.map((task, index) => (
                <TaskRow
                  index={index}
                  inputRef={(node) => {
                    taskInputRefs.current[index] = node;
                  }}
                  key={task.id}
                  onKeyDown={handleTaskKeyDown}
                  onTextChange={handleTaskTextChange}
                  onToggle={handleToggleTask}
                  task={task}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
            <MetricCard
              label="Current streak"
              note={stats.currentStreak > 0 ? "Consecutive perfect days right now." : "String together full-clear days to build momentum."}
              tone="success"
              value={`${stats.currentStreak}`}
            />
            <MetricCard
              label="Best streak"
              note="The highest run you have held so far."
              tone="warning"
              value={`${stats.bestStreak}`}
            />
            <MetricCard
              label="Completion rate"
              note="Across every non-empty task you have assigned."
              tone="neutral"
              value={`${stats.completionRate}%`}
            />
            <MetricCard
              label="Tasks finished"
              note="Total completed tasks in your local history."
              tone="success"
              value={`${stats.totalTasksCompleted}`}
            />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.92fr,1.08fr]">
          <PendingList
            onDelete={handleDeletePending}
            onPromote={handlePromotePending}
            pending={data.pending}
            today={today}
          />

          <div className="card-surface rounded-[30px] p-6 md:p-7">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.32em] text-[color:var(--muted)]">Momentum</p>
                <h2 className="mt-3 text-3xl font-semibold text-[color:var(--foreground)]">Last 7 days</h2>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                  A simple pulse check on how often you are actually closing the loop.
                </p>
              </div>
              <div className="surface-subtle rounded-[22px] px-4 py-3 text-sm text-[color:var(--muted)]">
                Max 3 completions per day
              </div>
            </div>
            <div className="mt-6 h-[290px] w-full">
              <ResponsiveContainer height="100%" width="100%">
                <BarChart data={chartData}>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 4" vertical={false} />
                  <XAxis
                    axisLine={false}
                    dataKey="label"
                    tick={{ fill: "var(--muted)", fontSize: 12 }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    domain={[0, 3]}
                    tick={{ fill: "var(--muted)", fontSize: 12 }}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--chart-hover)" }} />
                  <Bar dataKey="completed" radius={[12, 12, 0, 0]}>
                    {chartData.map((point) => (
                      <Cell
                        fill={
                          point.completed === 3
                            ? "var(--success)"
                            : point.completed === 0
                              ? "var(--chart-zero)"
                              : "var(--warning)"
                        }
                        key={point.date}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr,1fr]">
          <div className="card-surface rounded-[30px] p-6 md:p-7">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.32em] text-[color:var(--muted)]">Consistency</p>
                <h2 className="mt-3 text-3xl font-semibold text-[color:var(--foreground)]">Calendar</h2>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                  The last 12 weeks, colored by how many of your three commitments were finished.
                </p>
              </div>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted)]">
                <span>0</span>
                <span className="h-3 w-3 rounded-sm heat-0" />
                <span className="h-3 w-3 rounded-sm heat-1" />
                <span className="h-3 w-3 rounded-sm heat-2" />
                <span className="h-3 w-3 rounded-sm heat-3" />
                <span>3</span>
              </div>
            </div>
            <div className="mt-6 flex gap-3 overflow-x-auto pb-2 scroll-thin">
              <div className="grid grid-rows-7 gap-2 pt-7 text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                {weekdayLabels.map((label) => (
                  <div className="flex h-4 items-center" key={label}>
                    {label}
                  </div>
                ))}
              </div>
              <div className="grid grid-flow-col grid-rows-7 gap-2">
                {heatmapDays.map((day) => (
                  <div
                    className={`h-4 w-4 rounded-[4px] ${
                      day.completed === 3
                        ? "heat-3"
                        : day.completed === 2
                          ? "heat-2"
                          : day.completed === 1
                            ? "heat-1"
                            : "heat-0"
                    } ${day.isToday ? "ring-2 ring-[color:var(--foreground)] ring-offset-2 ring-offset-[color:var(--background)]" : ""}`}
                    key={day.date}
                    title={`${formatDisplayDate(day.date)}: ${day.completed} of 3 completed`}
                  />
                ))}
              </div>
            </div>
          </div>

          <ArchivePanel groups={archiveGroups} />
        </section>
      </div>
    </main>
  );
}
