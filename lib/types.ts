export type Task = {
  id: string;
  text: string;
  completed: boolean;
  carriedFromDate?: string | null;
};

export type DayEntry = {
  date: string;
  tasks: [Task, Task, Task];
};

export type PendingTask = {
  id: string;
  text: string;
  sourceDate: string;
};

export type AppData = {
  days: Record<string, DayEntry>;
  pending: PendingTask[];
  lastOpenedDate: string | null;
};

export type AppSettings = {
  celebrationsEnabled: boolean;
  darkMode: boolean;
  showMotivationalCopy: boolean;
};

export type AppExport = {
  version: number;
  exportedAt: string;
  data: AppData;
  settings: AppSettings;
};

export type AppStats = {
  currentStreak: number;
  bestStreak: number;
  completionRate: number;
  totalTasksCompleted: number;
};

export type ChartPoint = {
  date: string;
  label: string;
  completed: number;
};

export type HeatmapDay = {
  date: string;
  completed: number;
  isToday: boolean;
};

export type ArchiveGroup = {
  label: string;
  days: DayEntry[];
};
