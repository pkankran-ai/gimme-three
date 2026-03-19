import {
  AppData,
  AppExport,
  AppSettings,
  AppStats,
  ArchiveGroup,
  ChartPoint,
  DayEntry,
  HeatmapDay,
  PendingTask,
  Task
} from "@/lib/types";

export const STORAGE_KEY = "daily-three-data";
export const SETTINGS_STORAGE_KEY = "daily-three-settings";

export const DEFAULT_SETTINGS: AppSettings = {
  celebrationsEnabled: true,
  darkMode: false,
  showMotivationalCopy: true
};

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeText(text: string) {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function isValidDateKey(value: string) {
  return DATE_KEY_PATTERN.test(value);
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

function sanitizeTask(raw: unknown): Task {
  const task = isRecord(raw) ? raw : {};
  return {
    id: typeof task.id === "string" && task.id.trim() ? task.id : makeId("task"),
    text: typeof task.text === "string" ? task.text : "",
    completed: Boolean(task.completed),
    carriedFromDate:
      typeof task.carriedFromDate === "string" && isValidDateKey(task.carriedFromDate)
        ? task.carriedFromDate
        : null
  };
}

function sanitizePendingTask(raw: unknown): PendingTask | null {
  if (!isRecord(raw) || typeof raw.text !== "string") {
    return null;
  }

  const text = raw.text.trim();
  if (!text) {
    return null;
  }

  const sourceDate =
    typeof raw.sourceDate === "string" && isValidDateKey(raw.sourceDate)
      ? raw.sourceDate
      : getDateKey();

  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id : makeId("pending"),
    text,
    sourceDate
  };
}

export function createDayEntry(date: string, tasks?: Task[]): DayEntry {
  const normalizedTasks: Task[] = (tasks ?? []).slice(0, 3).map((task) => sanitizeTask(task));

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
    const normalized = sanitizePendingTask(item);
    if (!normalized) {
      continue;
    }

    const key = normalizeText(normalized.text);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    pending.push(normalized);
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

export function isDayComplete(day: DayEntry) {
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

export function findFirstEmptyTaskIndex(day: DayEntry) {
  return day.tasks.findIndex((task) => !task.text.trim());
}

export function sanitizeSettings(raw: unknown): AppSettings {
  const source = isRecord(raw) ? raw : {};

  return {
    celebrationsEnabled:
      typeof source.celebrationsEnabled === "boolean"
        ? source.celebrationsEnabled
        : DEFAULT_SETTINGS.celebrationsEnabled,
    darkMode: typeof source.darkMode === "boolean" ? source.darkMode : DEFAULT_SETTINGS.darkMode,
    showMotivationalCopy:
      typeof source.showMotivationalCopy === "boolean"
        ? source.showMotivationalCopy
        : DEFAULT_SETTINGS.showMotivationalCopy
  };
}

export function prepareAppDataForToday(raw: unknown, todayKey = getDateKey()): AppData {
  const source = isRecord(raw) ? raw : {};
  const rawDays = isRecord(source.days) ? source.days : {};
  const days: Record<string, DayEntry> = {};

  for (const [date, day] of Object.entries(rawDays)) {
    if (!isValidDateKey(date)) {
      continue;
    }

    const tasks = isRecord(day) && Array.isArray(day.tasks) ? day.tasks : [];
    days[date] = createDayEntry(date, tasks as Task[]);
  }

  if (!days[todayKey]) {
    days[todayKey] = createDayEntry(todayKey);
  }

  const lastOpenedDate =
    typeof source.lastOpenedDate === "string" && isValidDateKey(source.lastOpenedDate)
      ? source.lastOpenedDate
      : null;

  const rawPending = Array.isArray(source.pending) ? source.pending : [];
  let pending = normalizePending(rawPending as PendingTask[], days[todayKey].tasks);

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

export function buildExportPayload(data: AppData, settings: AppSettings) {
  const payload: AppExport = {
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
    settings
  };

  return JSON.stringify(payload, null, 2);
}

export function parseImportPayload(raw: string, todayKey = getDateKey()) {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("That file is not valid JSON.");
  }

  if (!isRecord(parsed)) {
    throw new Error("That backup file is not in a valid format.");
  }

  const sourceData = "data" in parsed ? parsed.data : parsed;
  const sourceSettings = "settings" in parsed ? parsed.settings : DEFAULT_SETTINGS;

  if (!isRecord(sourceData)) {
    throw new Error("That backup file is missing app data.");
  }

  if ("days" in sourceData && !isRecord(sourceData.days)) {
    throw new Error("The imported history is invalid.");
  }

  if ("pending" in sourceData && !Array.isArray(sourceData.pending)) {
    throw new Error("The imported pending task list is invalid.");
  }

  if (
    "lastOpenedDate" in sourceData &&
    sourceData.lastOpenedDate !== null &&
    typeof sourceData.lastOpenedDate !== "string"
  ) {
    throw new Error("The imported last-opened date is invalid.");
  }

  const rawDays = isRecord(sourceData.days) ? sourceData.days : {};
  for (const [date, day] of Object.entries(rawDays)) {
    if (!isValidDateKey(date)) {
      throw new Error("The backup includes an invalid date key.");
    }

    if (!isRecord(day) || !Array.isArray(day.tasks)) {
      throw new Error("One of the imported day entries is invalid.");
    }
  }

  const rawPending = Array.isArray(sourceData.pending) ? sourceData.pending : [];
  for (const item of rawPending) {
    if (!isRecord(item) || typeof item.text !== "string") {
      throw new Error("One of the imported pending tasks is invalid.");
    }
  }

  return {
    data: prepareAppDataForToday(sourceData, todayKey),
    settings: sanitizeSettings(sourceSettings)
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
    if (isDayComplete(day)) {
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
    if (!day || !isDayComplete(day)) {
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

export function getArchiveGroups(data: AppData, todayKey = getDateKey()): ArchiveGroup[] {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric"
  });

  const groups = new Map<string, DayEntry[]>();

  for (const day of getArchiveDays(data, todayKey)) {
    const label = formatter.format(parseDateKey(day.date));
    const current = groups.get(label) ?? [];
    current.push(day);
    groups.set(label, current);
  }

  return Array.from(groups.entries()).map(([label, days]) => ({
    label,
    days
  }));
}

export function canPromotePendingToToday(day: DayEntry) {
  return day.tasks.some((task) => !task.text.trim());
}

export function taskAlreadyExists(day: DayEntry, text: string) {
  const key = normalizeText(text);
  return day.tasks.some((task) => task.text.trim() && normalizeText(task.text) === key);
}
