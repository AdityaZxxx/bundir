import { afterAll, describe, expect, it } from "bun:test";
import { promises as fs } from "fs";
import { join } from "path";
import { organizeCommand } from "../commands";
import { createExtensionMap } from "../config";
import type { OrganizerConfig } from "../types";

const PERF_DIR = join(process.cwd(), "test-perf-workspace");

async function setupPerfDir(files: string[]) {
  await fs.rm(PERF_DIR, { recursive: true, force: true });
  await fs.mkdir(PERF_DIR, { recursive: true });
  await fs.writeFile(
    join(PERF_DIR, ".bundir.json"),
    JSON.stringify({
      options: {
        dryRun: false,
        verbose: false,
        defaultCategory: "others",
        ignoreHidden: true,
        conflictResolution: "skip",
      },
      categories: {
        images: { extensions: [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"], targetDir: "media/images" },
        documents: { extensions: [".pdf", ".docx", ".txt", ".md"], targetDir: "documents" },
        archives: { extensions: [".zip", ".rar", ".tar", ".gz", ".7z"], targetDir: "archives" },
        scripts: { extensions: [".js", ".ts", ".py", ".sh"], targetDir: "code/scripts" },
      },
    })
  );
  for (const f of files) {
    await fs.writeFile(join(PERF_DIR, f), "");
  }
}

describe("performance benchmarks", () => {
  const exts = [".png", ".jpg", ".pdf", ".txt", ".zip", ".js", ".py", ".md", ".gif", ".tar"];

  afterAll(async () => {
    await fs.rm(PERF_DIR, { recursive: true, force: true });
  });

  it("should organize 100 files in under 500ms", async () => {
    const files = Array.from({ length: 100 }, (_, i) => `file-${i}${exts[i % exts.length]}`);
    await setupPerfDir(files);

    const start = performance.now();
    await organizeCommand(PERF_DIR, { verbose: false });
    const elapsed = performance.now() - start;

    const images = await fs.readdir(join(PERF_DIR, "media/images"));
    const docs = await fs.readdir(join(PERF_DIR, "documents"));

    expect(images.length + docs.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(500);
  });

  it("should organize 500 files in under 2000ms", async () => {
    const files = Array.from({ length: 500 }, (_, i) => `file-${i}${exts[i % exts.length]}`);
    await setupPerfDir(files);

    const start = performance.now();
    await organizeCommand(PERF_DIR, { verbose: false });
    const elapsed = performance.now() - start;

    const images = await fs.readdir(join(PERF_DIR, "media/images"));
    const docs = await fs.readdir(join(PERF_DIR, "documents"));

    expect(images.length + docs.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(2000);
  });

  it("createExtensionMap with 10 categories should be fast", () => {
    const categories: OrganizerConfig["categories"] = {};
    for (let i = 0; i < 10; i++) {
      const letter = String.fromCharCode(97 + i);
      categories[`cat-${letter}`] = {
        extensions: [`.${letter}1`, `.${letter}2`, `.${letter}3`, `.${letter}4`, `.${letter}5`],
        targetDir: `dir-${letter}`,
      };
    }

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      createExtensionMap(categories);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
  });
});
