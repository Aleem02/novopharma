import { app } from "electron";
import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { Logger } from "../infrastructure/logger";
import {
  MedicineDirectoryRepository,
  MedicineDirectoryRecord,
} from "../database/repositories/medicineDirectoryRepository";

export type DirectoryState = "NOT_STARTED" | "IMPORTING" | "READY" | "FAILED";

export class MedicineDirectoryService {
  private static state: DirectoryState = "NOT_STARTED";
  private static errorDetails: string | null = null;

  static getStatus() {
    return {
      state: this.state,
      error: this.errorDetails,
    };
  }

  static getDatasetPath(): string {
    // 1. Dev Mode (in source folder structure)
    const devPath = join(
      app.getAppPath(),
      "src/renderer/src/assets/medicine_directory.json",
    );
    if (existsSync(devPath)) {
      return devPath;
    }

    // 2. Production (packaged extra resource relative to resourcesPath)
    const prodPath = join(process.resourcesPath, "medicine_directory.json");
    if (existsSync(prodPath)) {
      return prodPath;
    }

    // Fallback: root of application path
    const fallbackPath = join(app.getAppPath(), "medicine_directory.json");
    if (existsSync(fallbackPath)) {
      return fallbackPath;
    }

    throw new Error(
      `medicine_directory.json dataset not found. Checked devPath: "${devPath}" and prodPath: "${prodPath}"`,
    );
  }

  static initializeBackgroundImport(): void {
    if (this.state === "IMPORTING" || this.state === "READY") {
      return;
    }

    this.state = "IMPORTING";
    this.errorDetails = null;

    // Execute completely asynchronously to prevent blocking startup / event loop
    Promise.resolve().then(async () => {
      try {
        Logger.info(
          "MedicineDirectory",
          "Checking if medicine directory table contains records...",
        );
        const isPopulated = MedicineDirectoryRepository.isPopulated();
        if (isPopulated) {
          const count = MedicineDirectoryRepository.getCount();
          Logger.info(
            "MedicineDirectory",
            `Medicine directory already populated with ${count} records. State set to READY.`,
          );
          this.state = "READY";
          return;
        }

        Logger.info(
          "MedicineDirectory",
          "Medicine directory table is empty. Starting background import...",
        );
        const startTime = Date.now();
        const datasetPath = this.getDatasetPath();

        Logger.info(
          "MedicineDirectory",
          `Reading dataset from: ${datasetPath}`,
        );
        const rawContent = readFileSync(datasetPath, "utf8");

        Logger.info("MedicineDirectory", "Parsing dataset JSON...");
        const records = JSON.parse(rawContent) as MedicineDirectoryRecord[];

        Logger.info(
          "MedicineDirectory",
          `Parsed ${records.length} records. Committing bulk insert to SQLite...`,
        );
        MedicineDirectoryRepository.bulkInsert(records);

        const duration = Date.now() - startTime;
        Logger.info(
          "MedicineDirectory",
          `Import completed successfully in ${duration}ms. State set to READY.`,
        );
        this.state = "READY";
      } catch (error: any) {
        Logger.error(
          "MedicineDirectory",
          `Background import failed: ${error.message}`,
          error,
        );
        this.state = "FAILED";
        this.errorDetails = error.message;

        // Clear any half-inserted table state to ensure clean retry
        try {
          MedicineDirectoryRepository.clear();
        } catch (cleanupErr) {
          // ignore
        }
      }
    });
  }

  static async search(query: string): Promise<MedicineDirectoryRecord[]> {
    const cleanQuery = query.trim();
    if (cleanQuery.length < 2) {
      return [];
    }

    try {
      return MedicineDirectoryRepository.search(cleanQuery);
    } catch (error: any) {
      Logger.error(
        "MedicineDirectory",
        `Search query failed: ${error.message}`,
      );
      return [];
    }
  }
}
