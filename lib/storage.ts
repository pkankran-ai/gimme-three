import { prepareAppDataForToday, STORAGE_KEY } from "@/lib/daily-three";
import { AppData } from "@/lib/types";

export interface StorageAdapter {
  load(): AppData;
  save(data: AppData): void;
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
}
