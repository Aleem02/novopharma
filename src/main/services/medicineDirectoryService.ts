import { app } from "electron";
import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { Logger } from "../infrastructure/logger";
import { MedicineDirectoryRecord } from "../../shared/types";

export type DirectoryState = "NOT_STARTED" | "IMPORTING" | "READY" | "FAILED";

export class MedicineDirectoryService {
  private static state: DirectoryState = "NOT_STARTED";
  private static errorDetails: string | null = null;
  private static records: MedicineDirectoryRecord[] = [];
  private static loadPromise: Promise<void> | null = null;

  static getStatus() {
    return {
      state: this.state,
      error: this.errorDetails,
    };
  }

  static getDatasetPath(): string {
    // 1. Dev Mode (in source folder structure)
    try {
      const devPath = join(
        app.getAppPath(),
        "src/renderer/src/assets/medicine_directory.json",
      );
      if (existsSync(devPath)) {
        return devPath;
      }
    } catch {
      /* app.getAppPath() might fail in isolated test runners */
    }

    // Direct path relative to cwd (useful in dev/test)
    const cwdPath = join(
      process.cwd(),
      "src/renderer/src/assets/medicine_directory.json",
    );
    if (existsSync(cwdPath)) {
      return cwdPath;
    }

    // 2. Production (packaged extra resource relative to resourcesPath)
    if (process.resourcesPath) {
      const prodPath = join(process.resourcesPath, "medicine_directory.json");
      if (existsSync(prodPath)) {
        return prodPath;
      }
    }

    // Fallback: root of application path
    try {
      const fallbackPath = join(app.getAppPath(), "medicine_directory.json");
      if (existsSync(fallbackPath)) {
        return fallbackPath;
      }
    } catch {
      /* ignore */
    }

    throw new Error(
      `medicine_directory.json dataset not found. Checked cwdPath: "${cwdPath}"`,
    );
  }

  static async loadDataset(): Promise<void> {
    if (this.state === "READY") {
      return;
    }
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.state = "IMPORTING";
    this.errorDetails = null;

    this.loadPromise = (async () => {
      try {
        const startTime = Date.now();
        const datasetPath = this.getDatasetPath();
        Logger.info(
          "MedicineDirectory",
          `Loading in-memory dataset from: ${datasetPath}`,
        );

        const rawContent = readFileSync(datasetPath, "utf8");
        this.records = JSON.parse(rawContent) as MedicineDirectoryRecord[];

        const duration = Date.now() - startTime;
        Logger.info(
          "MedicineDirectory",
          `Loaded ${this.records.length} records into memory in ${duration}ms. State set to READY.`,
        );
        this.state = "READY";
      } catch (error: any) {
        Logger.error(
          "MedicineDirectory",
          `In-memory dataset load failed: ${error.message}`,
          error,
        );
        this.state = "FAILED";
        this.errorDetails = error.message;
        this.records = [];
      } finally {
        this.loadPromise = null;
      }
    })();

    return this.loadPromise;
  }

  static initializeBackgroundImport(): void {
    if (this.state === "IMPORTING" || this.state === "READY") {
      return;
    }

    // Execute completely asynchronously to prevent blocking startup / event loop
    Promise.resolve().then(() => this.loadDataset());
  }

  static async search(query: string): Promise<MedicineDirectoryRecord[]> {
    if (this.state !== "READY") {
      await this.loadDataset();
    }

    if (this.state !== "READY" || this.records.length === 0) {
      return [];
    }

    const cleanQuery = query.trim();
    if (cleanQuery.length < 2) {
      return [];
    }

    const qLower = cleanQuery.toLowerCase();
    const words = qLower.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) return [];

    const matches: Array<{
      item: MedicineDirectoryRecord;
      score: number;
      nameLower: string;
    }> = [];

    for (const item of this.records) {
      const nameLower = (item.name || "").toLowerCase();
      const genericLower = (item.generic_name || "").toLowerCase();
      const manufacturerLower = (item.manufacturer || "").toLowerCase();
      const strengthLower = (item.strength || "").toLowerCase();

      let matchesAllWords = true;
      for (const word of words) {
        if (
          !nameLower.includes(word) &&
          !genericLower.includes(word) &&
          !manufacturerLower.includes(word) &&
          !strengthLower.includes(word)
        ) {
          matchesAllWords = false;
          break;
        }
      }

      if (matchesAllWords) {
        let score = 4;
        if (nameLower.startsWith(qLower)) {
          score = 1;
        } else if (nameLower.includes(" " + qLower)) {
          score = 2;
        } else if (genericLower.startsWith(qLower)) {
          score = 3;
        }
        matches.push({ item, score, nameLower });
      }
    }

    matches.sort((a, b) => {
      if (a.score !== b.score) {
        return a.score - b.score;
      }
      return a.nameLower.localeCompare(b.nameLower);
    });

    return matches.slice(0, 50).map((m) => m.item);
  }
}
