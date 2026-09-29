import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MedicineDirectoryService } from "../main/services/medicineDirectoryService";
import { MedicineDirectoryRecord } from "../shared/types";
import { readFileSync, existsSync } from "fs";

// Legacy search implementation used for exact result-parity regression testing
function legacyOldSearch(records: MedicineDirectoryRecord[], query: string): MedicineDirectoryRecord[] {
  const preparedRecords = records.map((r) => ({
    record: r,
    nameLower: (r.name || "").toLowerCase(),
    genericLower: (r.generic_name || "").toLowerCase(),
    manufacturerLower: (r.manufacturer || "").toLowerCase(),
    strengthLower: (r.strength || "").toLowerCase(),
  }));

  const cleanQuery = query.trim();
  if (cleanQuery.length < 2) return [];

  const qLower = cleanQuery.toLowerCase();
  const words = qLower.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];

  const matches: Array<{
    item: MedicineDirectoryRecord;
    score: number;
    nameLower: string;
  }> = [];

  for (const item of preparedRecords) {
    let matchesAllWords = true;
    for (const word of words) {
      if (
        !item.nameLower.includes(word) &&
        !item.genericLower.includes(word) &&
        !item.manufacturerLower.includes(word) &&
        !item.strengthLower.includes(word)
      ) {
        matchesAllWords = false;
        break;
      }
    }

    if (matchesAllWords) {
      let score = 4;
      if (item.nameLower.startsWith(qLower)) {
        score = 1;
      } else if (item.nameLower.includes(" " + qLower)) {
        score = 2;
      } else if (item.genericLower.startsWith(qLower)) {
        score = 3;
      }
      matches.push({ item: item.record, score, nameLower: item.nameLower });
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

describe("MedicineDirectoryService (Option A Implementation)", () => {
  beforeEach(() => {
    // Reset service internal state before each test if needed
    // @ts-ignore
    MedicineDirectoryService.state = "NOT_STARTED";
    // @ts-ignore
    MedicineDirectoryService.records = [];
    // @ts-ignore
    MedicineDirectoryService.loadPromise = null;
    // @ts-ignore
    MedicineDirectoryService.errorDetails = null;
  });

  it("1. Dataset loads successfully into memory", async () => {
    await MedicineDirectoryService.loadDataset();
    const status = MedicineDirectoryService.getStatus();
    expect(status.state).toBe("READY");
    expect(status.error).toBeNull();
  });

  it("2. Correct record count: 246,045 records", async () => {
    await MedicineDirectoryService.loadDataset();
    // @ts-ignore
    const count = MedicineDirectoryService.records.length;
    expect(count).toBe(246045);
  });

  it("3. Regression Parity Test: Returns 100% exact same results as old PreparedRecord search", async () => {
    const datasetPath = MedicineDirectoryService.getDatasetPath();
    const rawContent = readFileSync(datasetPath, "utf8");
    const rawRecords = JSON.parse(rawContent) as MedicineDirectoryRecord[];

    await MedicineDirectoryService.loadDataset();

    const testQueries = [
      "Paracetamol",
      "Amoxicillin 500",
      "Pfizer",
      "Cetirizine Syrup",
      "Metformin",
      "Crocin 650mg",          // Exact medicine name
      "Ibuprofen",             // Generic name
      "Cipla",                 // Manufacturer
      "Dolo 650 Tablet",       // Multi-word query
      "NonExistentMedicine999" // No-match query
    ];

    for (const q of testQueries) {
      const oldResults = legacyOldSearch(rawRecords, q);
      const newResults = await MedicineDirectoryService.search(q);

      expect(newResults.length).toBe(oldResults.length);
      expect(newResults).toEqual(oldResults);
    }
  });

  it("4. Single-word search works correctly", async () => {
    const results = await MedicineDirectoryService.search("Paracetamol");
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(50);
  });

  it("5. Multi-word search enforces AND logic across all query words", async () => {
    const results = await MedicineDirectoryService.search("Cetirizine Syrup");
    expect(results.length).toBeGreaterThan(0);
    for (const item of results) {
      const fullText = `${item.name || ''} ${item.generic_name || ''} ${item.manufacturer || ''} ${item.strength || ''}`.toLowerCase();
      expect(fullText.includes("cetirizine")).toBe(true);
      expect(fullText.includes("syrup")).toBe(true);
    }
  });

  it("6. Manufacturer searches match records by manufacturer field", async () => {
    const results = await MedicineDirectoryService.search("Pfizer");
    expect(results.length).toBeGreaterThan(0);
    const hasMfr = results.some((r) => (r.manufacturer || "").toLowerCase().includes("pfizer"));
    expect(hasMfr).toBe(true);
  });

  it("7. Generic-name searches match records by generic_name field", async () => {
    const results = await MedicineDirectoryService.search("Metformin");
    expect(results.length).toBeGreaterThan(0);
    const hasGeneric = results.some((r) => (r.generic_name || "").toLowerCase().includes("metformin"));
    expect(hasGeneric).toBe(true);
  });

  it("8. Strength searches match records by strength field", async () => {
    const results = await MedicineDirectoryService.search("500mg");
    expect(results.length).toBeGreaterThan(0);
    const hasStrength = results.some((r) => (r.strength || "").toLowerCase().includes("500mg"));
    expect(hasStrength).toBe(true);
  });

  it("9. No-match search returns empty array", async () => {
    const results = await MedicineDirectoryService.search("XyZ123NonExistentDrug");
    expect(results).toEqual([]);
  });

  it("10. Enforces top-50 limit on search results", async () => {
    const results = await MedicineDirectoryService.search("Tablet");
    expect(results.length).toBe(50);
  });

  it("11. Ranking order places startsWith name (Score 1) before word boundary (Score 2) and fallback (Score 4)", async () => {
    const results = await MedicineDirectoryService.search("Para");
    expect(results.length).toBeGreaterThan(0);
    // Top result should start with "Para"
    expect(results[0].name.toLowerCase().startsWith("para")).toBe(true);
  });

  it("12. Alphabetical tie-breaking orders same-score results alphabetically by name", async () => {
    const results = await MedicineDirectoryService.search("Aspirin");
    expect(results.length).toBeGreaterThan(1);
    const getScore = (item: MedicineDirectoryRecord) => {
      const qLower = "aspirin";
      const nameLower = (item.name || "").toLowerCase();
      const genericLower = (item.generic_name || "").toLowerCase();
      if (nameLower.startsWith(qLower)) return 1;
      if (nameLower.includes(" " + qLower)) return 2;
      if (genericLower.startsWith(qLower)) return 3;
      return 4;
    };
    for (let i = 0; i < results.length - 1; i++) {
      const r1 = results[i];
      const r2 = results[i + 1];
      const s1 = getScore(r1);
      const s2 = getScore(r2);
      if (s1 === s2) {
        expect(r1.name.toLowerCase().localeCompare(r2.name.toLowerCase())).toBeLessThanOrEqual(0);
      } else {
        expect(s1).toBeLessThan(s2);
      }
    }
  });

  it("13. Search before READY state automatically triggers loadDataset and returns results", async () => {
    const results = await MedicineDirectoryService.search("Paracetamol");
    expect(results.length).toBeGreaterThan(0);
    expect(MedicineDirectoryService.getStatus().state).toBe("READY");
  });

  it("14. Missing/corrupt dataset sets status to FAILED and returns empty search results", async () => {
    vi.spyOn(MedicineDirectoryService, "getDatasetPath").mockReturnValue("/invalid/non_existent_file.json");

    await expect(MedicineDirectoryService.loadDataset()).resolves.toBeUndefined();
    const status = MedicineDirectoryService.getStatus();
    expect(status.state).toBe("FAILED");
    expect(status.error).toBeDefined();

    const results = await MedicineDirectoryService.search("Paracetamol");
    expect(results).toEqual([]);
  });

  it("15. status() returns exact expected DirectoryState object structure", () => {
    const status = MedicineDirectoryService.getStatus();
    expect(status).toHaveProperty("state");
    expect(status).toHaveProperty("error");
    expect(typeof status.state).toBe("string");
  });
});
