import {
  DEFAULT_SETTINGS,
  prepareAppDataForToday,
  sanitizeSettings,
  SETTINGS_STORAGE_KEY,
  STORAGE_KEY
} from "@/lib/daily-three";
import { AppData, AppSettings } from "@/lib/types";

export interface StorageAdapter {
  load(): AppData;
  save(data: AppData): void;
  loadSettings(): AppSettings;
  saveSettings(settings: AppSettings): void;
}

export class LocalStorageAdapter implements StorageAdapter {
  load() {
    if (typeof window === "undefined") {
      return prepareAppDataForToday(null);
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return prepareAppDataForToday(raw ? JSON.parse(raw) : null);
    } catch {
      return prepareAppDataForToday(null);
    }
  }

  save(data: AppData) {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  loadSettings() {
    if (typeof window === "undefined") {
      return DEFAULT_SETTINGS;
    }

    try {
      const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      return sanitizeSettings(raw ? JSON.parse(raw) : null);
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  saveSettings(settings: AppSettings) {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }
}
