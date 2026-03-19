"use client";

import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  canPromotePendingToToday,
  countCompletedTasks,
  createDayEntry,
  formatDisplayDate,
  getAppStats,
  getArchiveDays,
  getDateKey,
  getHeatmapDays,
  getLast7DaysChart,
  taskAlreadyExists
} from "@/lib/daily-three";
import { LocalStorageAdapter } from "@/lib/storage";
import { AppData, DayEntry, PendingTask, Task } from "@/lib/types";

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function MetricCard({
  label,
  value,
  accent
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="card-surface rounded-[28px] p-5 animate-fade-up">
      <p className="text-[11px] uppercase tracking-[0.32em] text-black/45">{label}</p>
      <p className={`mt-3 text-4xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}

function TaskRow({
  task,
  index,
  onTextChange,
  onToggle
}: {
  task: Task;
  index: number;
  onTextChange: (index: number, value: string) => void;
  onToggle: (index: number) => void;
}) {
  return (
    <div className="task-ring rounded-[24px] border border-black/5 bg-white/70 p-4 transition hover:-translate-y-0.5">
      <div className="flex items-start gap-4">
        <button
          aria-label={`Toggle task ${index + 1}`}
          className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition ${
            task.completed
              ? "border-moss bg-moss text-white"
              : "border-black/15 bg-white text-transparent hover:border-black/35"
          }`}
          onClick={() => onToggle(index)}
          type="button"
        >
          v
        </button>
        <div className="flex-1">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[11px] uppercase tracking-[0.28em] text-black/40">
              Slot 0{index + 1}
            </span>
            {task.carriedFromDate ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-amber-900">
                Carried from {formatDisplayDate(task.carriedFromDate, { month: "short", day: "numeric" })}
              </span>
            ) : null}
          </div>
          <input
            className={`w-full border-0 bg-transparent p-0 text-lg outline-none placeholder:text-black/25 ${
              task.completed ? "text-black/45 line-through" : "text-ink"
            }`}
            maxLength={120}
            onChange={(event) => onTextChange(index, event.target.value)}
            placeholder="Write the non-negotiable."
            value={task.text}
          />
        </div>
      </div>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white/95 px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-ink">{label}</p>
      <p className="mt-1 text-black/60">{payload[0]?.value ?? 0} of 3 completed</p>
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

  if (!pending.length) {
    return (
      <div className="card-surface rounded-[28px] p-6 animate-fade-up">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold text-ink">Pending</h2>
          <span className="rounded-full border border-black/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-black/45">
            Empty
          </span>
        </div>
        <p className="mt-4 max-w-xl text-sm leading-6 text-black/55">
          Anything unfinished rolls here at the next daily reset. It stays visible until you promote or delete it.
        </p>
      </div>
    );
  }

  return (
    <div className="card-surface rounded-[28px] p-6 animate-fade-up">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-ink">Pending</h2>
        <span className="rounded-full border border-black/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-black/45">
          {pending.length} waiting
        </span>
      </div>
      <div className="mt-5 space-y-3">
        {pending.map((task) => (
          <div
            className="rounded-[22px] border border-black/5 bg-white/75 p-4"
            key={task.id}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="truncate text-base text-ink">{task.text}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.24em] text-black/42">
                  From {formatDisplayDate(task.sourceDate, { month: "short", day: "numeric" })}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.18em] transition ${
                    canAdd
                      ? "bg-moss text-white hover:bg-moss/90"
                      : "cursor-not-allowed bg-black/8 text-black/35"
                  }`}
                  disabled={!canAdd}
                  onClick={() => onPromote(task.id)}
                  type="button"
                >
                  Move to today
                </button>
                <button
                  className="rounded-full border border-black/10 px-4 py-2 text-xs uppercase tracking-[0.18em] text-black/65 transition hover:border-black/25 hover:text-black"
                  onClick={() => onDelete(task.id)}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {!canAdd ? (
        <p className="mt-4 text-xs uppercase tracking-[0.2em] text-ember">
          Today is full. Clear an empty slot before pulling more in.
        </p>
      ) : null}
    </div>
  );
}

export function DailyThreeApp() {
  const adapterRef = useRef(new LocalStorageAdapter());
  const [data, setData] = useState<AppData | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const nextData = adapterRef.current.load();
    setData(nextData);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated || !data) {
      return;
    }

    adapterRef.current.save(data);
  }, [data, isHydrated]);

  if (!data) {
    return (
      <main className="min-h-screen px-4 py-10 md:px-8">
        <div className="mx-auto flex min-h-[80vh] max-w-6xl items-center justify-center">
          <div className="card-surface rounded-[32px] px-8 py-10 text-center">
            <p className="text-[11px] uppercase tracking-[0.3em] text-black/45">Daily Three</p>
            <h1 className="mt-4 text-4xl font-semibold text-ink">Loading your accountability board...</h1>
          </div>
        </div>
      </main>
    );
  }

  const todayKey = getDateKey();
  const today = data.days[todayKey] ?? createDayEntry(todayKey);
  const stats = getAppStats(data, todayKey);
  const chartData = getLast7DaysChart(data, todayKey);
  const heatmapDays = getHeatmapDays(data, todayKey);
  const archiveDays = getArchiveDays(data, todayKey);
  const completionToday = countCompletedTasks(today);

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

  const handlePromotePending = (taskId: string) => {
    setData((current) => {
      if (!current) {
        return current;
      }

      const pendingTask = current.pending.find((item) => item.id === taskId);
      const currentDay = current.days[todayKey] ?? createDayEntry(todayKey);

      if (!pendingTask || taskAlreadyExists(currentDay, pendingTask.text)) {
        return {
          ...current,
          pending: current.pending.filter((item) => item.id !== taskId)
        };
      }

      const emptyIndex = currentDay.tasks.findIndex((task) => !task.text.trim());
      if (emptyIndex === -1) {
        return current;
      }

      const tasks = [...currentDay.tasks] as Task[];
      tasks[emptyIndex] = {
        id: tasks[emptyIndex].id,
        text: pendingTask.text,
        completed: false,
        carriedFromDate: pendingTask.sourceDate
      };

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
  };

  return (
    <main className="min-h-screen px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
          <div className="card-surface card-strong rounded-[36px] p-6 md:p-8 animate-fade-up">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] uppercase tracking-[0.34em] text-black/50">Daily Three</p>
                <h1 className="mt-4 text-4xl font-semibold text-ink md:text-6xl">
                  Three tasks. No escape hatches.
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-7 text-black/60 md:text-base">
                  Define the three things that make today count, finish them, and let the app keep score.
                </p>
              </div>
              <div className="rounded-[28px] border border-black/8 bg-white/70 px-5 py-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-black/45">Today</p>
                <p className="mt-2 text-2xl font-semibold text-ink">{formatDisplayDate(todayKey)}</p>
                <p className="mt-2 text-sm text-black/55">{completionToday} of 3 complete</p>
              </div>
            </div>

            <div className="mt-8 grid gap-4">
              {today.tasks.map((task, index) => (
                <TaskRow
                  index={index}
                  key={task.id}
                  onTextChange={handleTaskTextChange}
                  onToggle={handleToggleTask}
                  task={task}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
            <MetricCard accent="text-moss" label="Current streak" value={`${stats.currentStreak}`} />
            <MetricCard accent="text-ember" label="Best streak" value={`${stats.bestStreak}`} />
            <MetricCard accent="text-ink" label="Completion rate" value={`${stats.completionRate}%`} />
            <MetricCard accent="text-moss" label="Tasks finished" value={`${stats.totalTasksCompleted}`} />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
          <PendingList
            onDelete={handleDeletePending}
            onPromote={handlePromotePending}
            pending={data.pending}
            today={today}
          />

          <div className="card-surface rounded-[28px] p-6 animate-fade-up">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-ink">Last 7 days</h2>
                <p className="mt-2 text-sm leading-6 text-black/55">
                  A quick pulse check on how often you actually closed the loop.
                </p>
              </div>
            </div>
            <div className="mt-6 h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid stroke="rgba(22,17,15,0.08)" strokeDasharray="4 4" vertical={false} />
                  <XAxis axisLine={false} dataKey="label" tick={{ fill: "rgba(22,17,15,0.55)", fontSize: 12 }} tickLine={false} />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    domain={[0, 3]}
                    tick={{ fill: "rgba(22,17,15,0.55)", fontSize: 12 }}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(22,17,15,0.04)" }} />
                  <Bar dataKey="completed" radius={[12, 12, 0, 0]}>
                    {chartData.map((point) => (
                      <Cell
                        fill={point.completed === 3 ? "#60735f" : point.completed === 0 ? "#d7cec1" : "#b45d45"}
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
          <div className="card-surface rounded-[28px] p-6 animate-fade-up">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-ink">Consistency calendar</h2>
                <p className="mt-2 text-sm leading-6 text-black/55">
                  The last 12 weeks, colored by how many of your three daily commitments were completed.
                </p>
              </div>
              <div className="flex gap-2 text-[10px] uppercase tracking-[0.22em] text-black/45">
                <span>0</span>
                <span className="h-3 w-3 rounded-sm heat-0" />
                <span className="h-3 w-3 rounded-sm heat-1" />
                <span className="h-3 w-3 rounded-sm heat-2" />
                <span className="h-3 w-3 rounded-sm heat-3" />
                <span>3</span>
              </div>
            </div>
            <div className="mt-6 flex gap-3 overflow-x-auto pb-2 scroll-thin">
              <div className="grid grid-rows-7 gap-2 pt-7 text-[10px] uppercase tracking-[0.2em] text-black/38">
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
                    } ${day.isToday ? "ring-2 ring-ink/40 ring-offset-2 ring-offset-[#f7f1e8]" : ""}`}
                    key={day.date}
                    title={`${formatDisplayDate(day.date)}: ${day.completed} of 3 completed`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="card-surface rounded-[28px] p-6 animate-fade-up">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-ink">Archive</h2>
                <p className="mt-2 text-sm leading-6 text-black/55">
                  Every completed or unfinished day stays visible. The order is newest first.
                </p>
              </div>
              <span className="rounded-full border border-black/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-black/45">
                {archiveDays.length} days
              </span>
            </div>
            <div className="mt-5 max-h-[420px] space-y-3 overflow-y-auto pr-1 scroll-thin">
              {archiveDays.length ? (
                archiveDays.map((day) => (
                  <div className="rounded-[22px] border border-black/6 bg-white/78 p-4" key={day.date}>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold text-ink">{formatDisplayDate(day.date)}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-black/42">
                          {countCompletedTasks(day)} of 3 completed
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.22em] ${
                          countCompletedTasks(day) === 3
                            ? "bg-moss/15 text-moss"
                            : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {countCompletedTasks(day) === 3 ? "Full clear" : "Incomplete"}
                      </span>
                    </div>
                    <div className="mt-4 space-y-2">
                      {day.tasks.map((task) => (
                        <div
                          className={`rounded-2xl border px-3 py-2 text-sm ${
                            task.completed
                              ? "border-moss/15 bg-moss/10 text-ink"
                              : "border-black/8 bg-black/[0.03] text-black/65"
                          }`}
                          key={task.id}
                        >
                          {task.text.trim() ? task.text : "Empty slot"}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-black/12 bg-white/60 p-6 text-sm leading-6 text-black/55">
                  Your archive will start building after the first daily reset.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
