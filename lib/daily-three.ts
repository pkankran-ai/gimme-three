import { AppData, AppStats, ChartPoint, DayEntry, HeatmapDay, PendingTask, Task } from "@/lib/types";

export const STORAGE_KEY = "daily-three-data";

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeText(text: string) {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

export function getDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDisplayDate(dateKey: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options
  }).format(parseDateKey(dateKey));
}

export function createEmptyTask(): Task {
  return {
    id: makeId("task"),
    text: "",
    completed: false,
    carriedFromDate: null
  };
}

export function createDayEntry(date: string, tasks?: Task[]): DayEntry {
  const normalizedTasks: Task[] = (tasks ?? []).slice(0, 3).map((task) => ({
    id: task.id || makeId("task"),
    text: typeof task.text === "string" ? task.text : "",
    completed: Boolean(task.completed),
    carriedFromDate: task.carriedFromDate ?? null
  }));

  while (normalizedTasks.length < 3) {
    normalizedTasks.push(createEmptyTask());
  }

  return {
    date,
    tasks: normalizedTasks as [Task, Task, Task]
  };
}

function normalizePending(items: PendingTask[] | undefined, currentTasks: Task[] = []) {
  const seen = new Set(currentTasks.filter((task) => task.text.trim()).map((task) => normalizeText(task.text)));
  const pending: PendingTask[] = [];

  for (const item of items ?? []) {
    if (!item || typeof item.text !== "string") {
      continue;
    }

    const text = item.text.trim();
    if (!text) {
      continue;
    }

    const key = normalizeText(text);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    pending.push({
      id: item.id || makeId("pending"),
      text,
      sourceDate: item.sourceDate || getDateKey()
    });
  }

  return pending;
}

function toPendingTask(task: Task, sourceDate: string): PendingTask {
  return {
    id: makeId("pending"),
    text: task.text.trim(),
    sourceDate
  };
}

function isPerfectDay(day: DayEntry) {
  return day.tasks.every((task) => task.text.trim() && task.completed);
}

function isNextCalendarDay(previous: string, current: string) {
  const previousDate = parseDateKey(previous);
  const currentDate = parseDateKey(current);
  const diff = currentDate.getTime() - previousDate.getTime();
  return diff === 24 * 60 * 60 * 1000;
}

export function countCompletedTasks(day: DayEntry) {
  return day.tasks.filter((task) => task.text.trim() && task.completed).length;
}

export function prepareAppDataForToday(raw: unknown, todayKey = getDateKey()): AppData {
  const source = raw as Partial<AppData> | null | undefined;
  const days: Record<string, DayEntry> = {};

  for (const [date, day] of Object.entries(source?.days ?? {})) {
    const tasks = Array.isArray(day?.tasks) ? day.tasks : [];
    days[date] = createDayEntry(date, tasks);
  }

  if (!days[todayKey]) {
    days[todayKey] = createDayEntry(todayKey);
  }

  const lastOpenedDate = typeof source?.lastOpenedDate === "string" ? source.lastOpenedDate : null;
  let pending = normalizePending(source?.pending, days[todayKey].tasks);

  if (lastOpenedDate && lastOpenedDate !== todayKey) {
    const previousDay = days[lastOpenedDate];

    if (previousDay) {
      pending = normalizePending(
        [
          ...pending,
          ...previousDay.tasks
            .filter((task) => task.text.trim() && !task.completed)
            .map((task) => toPendingTask(task, lastOpenedDate))
        ],
        days[todayKey].tasks
      );
    }
  }

  return {
    days,
    pending,
    lastOpenedDate: todayKey
  };
}

export function getAppStats(data: AppData, todayKey = getDateKey()): AppStats {
  const entries = Object.values(data.days).sort((a, b) => a.date.localeCompare(b.date));

  let totalAssigned = 0;
  let totalTasksCompleted = 0;

  for (const day of entries) {
    totalAssigned += day.tasks.filter((task) => task.text.trim()).length;
    totalTasksCompleted += countCompletedTasks(day);
  }

  let bestStreak = 0;
  let runningStreak = 0;
  let previousPerfectDate: string | null = null;

  for (const day of entries) {
    if (isPerfectDay(day)) {
      if (previousPerfectDate && isNextCalendarDay(previousPerfectDate, day.date)) {
        runningStreak += 1;
      } else {
        runningStreak = 1;
      }

      previousPerfectDate = day.date;
      bestStreak = Math.max(bestStreak, runningStreak);
    } else {
      previousPerfectDate = null;
      runningStreak = 0;
    }
  }

  let currentStreak = 0;
  let cursor = todayKey;

  while (true) {
    const day = data.days[cursor];
    if (!day || !isPerfectDay(day)) {
      break;
    }

    currentStreak += 1;

    const previousDate = parseDateKey(cursor);
    previousDate.setDate(previousDate.getDate() - 1);
    cursor = getDateKey(previousDate);
  }

  return {
    currentStreak,
    bestStreak,
    completionRate: totalAssigned === 0 ? 0 : Math.round((totalTasksCompleted / totalAssigned) * 100),
    totalTasksCompleted
  };
}

export function getLast7DaysChart(data: AppData, todayKey = getDateKey()): ChartPoint[] {
  const today = parseDateKey(todayKey);
  const points: ChartPoint[] = [];

  for (let index = 6; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    const dateKey = getDateKey(date);
    const day = data.days[dateKey];
    points.push({
      date: dateKey,
      label: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date),
      completed: day ? countCompletedTasks(day) : 0
    });
  }

  return points;
}

export function getHeatmapDays(data: AppData, todayKey = getDateKey(), length = 84): HeatmapDay[] {
  const today = parseDateKey(todayKey);
  const days: HeatmapDay[] = [];

  for (let index = length - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    const dateKey = getDateKey(date);
    const day = data.days[dateKey];
    days.push({
      date: dateKey,
      completed: day ? countCompletedTasks(day) : 0,
      isToday: dateKey === todayKey
    });
  }

  return days;
}

export function getArchiveDays(data: AppData, todayKey = getDateKey()) {
  return Object.values(data.days)
    .filter((day) => day.date !== todayKey)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function canPromotePendingToToday(day: DayEntry) {
  return day.tasks.some((task) => !task.text.trim());
}

export function taskAlreadyExists(day: DayEntry, text: string) {
  const key = normalizeText(text);
  return day.tasks.some((task) => task.text.trim() && normalizeText(task.text) === key);
}
