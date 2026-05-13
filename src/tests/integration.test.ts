import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { promises as fs } from "fs";
import { join } from "path";
import { loadConfig, createExtensionMap } from "../config";
import { initCommand, organizeCommand, undoCommand } from "../commands";
import type { OrganizerConfig } from "../types";

const TEST_DIR = join(process.cwd(), "test-integration-workspace");

function createConfig(overrides?: {
  options?: Partial<OrganizerConfig["options"]>;
  categories?: Record<string, { extensions: string[]; targetDir: string }>;
}): OrganizerConfig {
  return {
    options: {
      dryRun: false,
      verbose: false,
      defaultCategory: "others",
      ignoreHidden: true,
      conflictResolution: "skip",
      recursive: false,
      ...overrides?.options,
    },
    categories: {
      images: { extensions: [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"], targetDir: "media/images" },
      documents: { extensions: [".pdf", ".docx", ".txt", ".md"], targetDir: "documents" },
      archives: { extensions: [".zip", ".rar", ".tar", ".gz", ".7z"], targetDir: "archives" },
      scripts: { extensions: [".js", ".ts", ".py", ".sh"], targetDir: "code/scripts" },
      ...overrides?.categories,
    },
  };
}

async function createTestFile(dir: string, relativePath: string, content = "") {
  const fullPath = join(dir, relativePath);
  await fs.mkdir(join(dir, relativePath.split("/").slice(0, -1).join("/")), { recursive: true });
  await fs.writeFile(fullPath, content);
  return fullPath;
}

function withChdir(dir: string, fn: () => Promise<void>) {
  return async () => {
    const originalCwd = process.cwd();
    process.chdir(dir);
    try {
      await fn();
    } finally {
      process.chdir(originalCwd);
    }
  };
}

describe("integration - organize command", () => {
  beforeEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_DIR, { recursive: true });
    await fs.writeFile(join(TEST_DIR, ".bundir.json"), JSON.stringify(createConfig(), null, 2));
    await Bun.file(join(process.cwd(), ".bundir-undo.log"))
      .delete()
      .catch(() => {});
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it("should organize multiple file types into correct directories", async () => {
    await createTestFile(TEST_DIR, "photo.png");
    await createTestFile(TEST_DIR, "report.pdf");
    await createTestFile(TEST_DIR, "archive.zip");
    await createTestFile(TEST_DIR, "script.py");

    await organizeCommand(TEST_DIR, { verbose: false });

    expect(await fs.exists(join(TEST_DIR, "media/images/photo.png"))).toBe(true);
    expect(await fs.exists(join(TEST_DIR, "documents/report.pdf"))).toBe(true);
    expect(await fs.exists(join(TEST_DIR, "archives/archive.zip"))).toBe(true);
    expect(await fs.exists(join(TEST_DIR, "code/scripts/script.py"))).toBe(true);
    expect(await fs.exists(join(TEST_DIR, "photo.png"))).toBe(false);
  });

  it("should move unknown extensions to defaultCategory", async () => {
    await createTestFile(TEST_DIR, "unknown.xyz");
    await createTestFile(TEST_DIR, "readme.md");

    await organizeCommand(TEST_DIR, { verbose: false, defaultCategory: "others" });

    expect(await fs.exists(join(TEST_DIR, "others/unknown.xyz"))).toBe(true);
    expect(await fs.exists(join(TEST_DIR, "documents/readme.md"))).toBe(true);
  });

  it("should ignore hidden files when ignoreHidden is true", async () => {
    await createTestFile(TEST_DIR, ".env");
    await createTestFile(TEST_DIR, ".gitkeep");
    await createTestFile(TEST_DIR, "file.txt");

    await organizeCommand(TEST_DIR, { ignoreHidden: true, verbose: false });

    expect(await fs.exists(join(TEST_DIR, ".env"))).toBe(true);
    expect(await fs.exists(join(TEST_DIR, ".gitkeep"))).toBe(true);
    expect(await fs.exists(join(TEST_DIR, "documents/file.txt"))).toBe(true);
  });

  it("should not move hidden files when ignoreHidden is false", async () => {
    await createTestFile(TEST_DIR, ".env");
    await createTestFile(TEST_DIR, "file.txt");

    await organizeCommand(TEST_DIR, { ignoreHidden: false, verbose: false });

    expect(await fs.exists(join(TEST_DIR, ".env"))).toBe(false);
    expect(await fs.exists(join(TEST_DIR, "documents/file.txt"))).toBe(true);
  });

  it("should handle files with special characters in names", async () => {
    await createTestFile(TEST_DIR, "my photo (vacation 2024!).png");
    await createTestFile(TEST_DIR, "project#1 (final).pdf");

    await organizeCommand(TEST_DIR, { verbose: false });

    expect(await fs.exists(join(TEST_DIR, "media/images", "my photo (vacation 2024!).png"))).toBe(true);
    expect(await fs.exists(join(TEST_DIR, "documents", "project#1 (final).pdf"))).toBe(true);
  });

  it("should not move files that are already in a category directory", async () => {
    await createTestFile(TEST_DIR, "documents/report.pdf");
    await createTestFile(TEST_DIR, "photo.png");

    await organizeCommand(TEST_DIR, { verbose: false });

    expect(await fs.exists(join(TEST_DIR, "documents/report.pdf"))).toBe(true);
    expect(await fs.exists(join(TEST_DIR, "media/images/photo.png"))).toBe(true);
    expect(await fs.exists(join(TEST_DIR, "photo.png"))).toBe(false);
  });

  it("should not create undo log in dry-run mode", async () => {
    await createTestFile(TEST_DIR, "photo.png");

    await organizeCommand(TEST_DIR, { dryRun: true, verbose: false });

    expect(await fs.exists(join(TEST_DIR, "media/images/photo.png"))).toBe(false);
    expect(await fs.exists(join(TEST_DIR, "photo.png"))).toBe(true);
    expect(await fs.exists(join(process.cwd(), ".bundir-undo.log"))).toBe(false);
  });

  it("should organize files recursively and maintain directory structure", async () => {
    await createTestFile(TEST_DIR, "sub1/deep-photo.png");
    await createTestFile(TEST_DIR, "sub1/sub2/nested-doc.pdf");
    await createTestFile(TEST_DIR, "root-image.png");

    await organizeCommand(TEST_DIR, { recursive: true, verbose: false });

    expect(await fs.exists(join(TEST_DIR, "sub1/media/images/deep-photo.png"))).toBe(true);
    expect(await fs.exists(join(TEST_DIR, "sub1/sub2/documents/nested-doc.pdf"))).toBe(true);
    expect(await fs.exists(join(TEST_DIR, "media/images/root-image.png"))).toBe(true);
    expect(await fs.exists(join(TEST_DIR, "sub1/deep-photo.png"))).toBe(false);
  });

  it("should handle an empty directory without errors", async () => {
    await expect(organizeCommand(TEST_DIR, { verbose: false })).resolves.toBeUndefined();
  });

  it("should handle subdirectories with no files", async () => {
    await fs.mkdir(join(TEST_DIR, "empty-subdir"), { recursive: true });
    await createTestFile(TEST_DIR, "photo.png");

    await organizeCommand(TEST_DIR, { recursive: true, verbose: false });

    expect(await fs.exists(join(TEST_DIR, "media/images/photo.png"))).toBe(true);
    expect(await fs.exists(join(TEST_DIR, "empty-subdir"))).toBe(true);
  });

  it("should undo full organization correctly", async () => {
    await createTestFile(TEST_DIR, "photo.png");
    await createTestFile(TEST_DIR, "doc.pdf");

    await organizeCommand(TEST_DIR, { verbose: false });

    expect(await fs.exists(join(TEST_DIR, "media/images/photo.png"))).toBe(true);
    expect(await fs.exists(join(TEST_DIR, "documents/doc.pdf"))).toBe(true);

    await undoCommand();

    expect(await fs.exists(join(TEST_DIR, "photo.png"))).toBe(true);
    expect(await fs.exists(join(TEST_DIR, "doc.pdf"))).toBe(true);
    expect(await fs.exists(join(TEST_DIR, "media/images/photo.png"))).toBe(false);
    expect(await fs.exists(join(TEST_DIR, "documents/doc.pdf"))).toBe(false);
  });

  it("should undo only the last organization, not earlier ones", async () => {
    await createTestFile(TEST_DIR, "photo.png");
    await organizeCommand(TEST_DIR, { verbose: false });
    expect(await fs.exists(join(TEST_DIR, "media/images/photo.png"))).toBe(true);

    await createTestFile(TEST_DIR, "doc.pdf");
    await organizeCommand(TEST_DIR, { verbose: false });
    expect(await fs.exists(join(TEST_DIR, "documents/doc.pdf"))).toBe(true);

    await undoCommand();

    expect(await fs.exists(join(TEST_DIR, "doc.pdf"))).toBe(true);
    expect(await fs.exists(join(TEST_DIR, "photo.png"))).toBe(false);
  });

  it("should handle conflict resolution 'skip' correctly", async () => {
    await createTestFile(TEST_DIR, "photo.png");
    await organizeCommand(TEST_DIR, { verbose: false });

    await createTestFile(TEST_DIR, "photo.png", "new content");

    await organizeCommand(TEST_DIR, { conflictResolution: "skip", verbose: false });

    const originalContent = await fs.readFile(join(TEST_DIR, "media/images/photo.png"), "utf-8");
    expect(originalContent).toBe("");

    expect(await fs.exists(join(TEST_DIR, "photo.png"))).toBe(true);
  });

  it("should handle large number of files (100+)", async () => {
    for (let i = 0; i < 50; i++) {
      await createTestFile(TEST_DIR, `photo-${i}.png`);
    }
    for (let i = 0; i < 50; i++) {
      await createTestFile(TEST_DIR, `doc-${i}.pdf`);
    }

    await organizeCommand(TEST_DIR, { verbose: false });

    const imagesDir = join(TEST_DIR, "media/images");
    const docsDir = join(TEST_DIR, "documents");

    const images = await fs.readdir(imagesDir);
    const docs = await fs.readdir(docsDir);

    expect(images.length).toBe(50);
    expect(docs.length).toBe(50);
  });
});

describe("integration - init command", () => {
  const TEST_DIR_INIT = join(process.cwd(), "test-init-workspace");

  async function runInitInDir(fn: () => Promise<void>) {
    await fs.rm(TEST_DIR_INIT, { recursive: true, force: true });
    await fs.mkdir(TEST_DIR_INIT, { recursive: true });
    const originalCwd = process.cwd();
    process.chdir(TEST_DIR_INIT);
    try {
      await fn();
    } finally {
      process.chdir(originalCwd);
      await fs.rm(TEST_DIR_INIT, { recursive: true, force: true });
    }
  }

  it("should create a .bundir.json config file", async () => {
    await runInitInDir(async () => {
      await initCommand();

      const configPath = join(TEST_DIR_INIT, ".bundir.json");
      expect(await fs.exists(configPath)).toBe(true);

      const content = await fs.readFile(configPath, "utf-8");
      const config = JSON.parse(content);
      expect(config.options).toBeDefined();
      expect(config.categories).toBeDefined();
      expect(config.options.dryRun).toBe(false);
    });
  });

  it("should not overwrite an existing .bundir.json", async () => {
    await runInitInDir(async () => {
      const existingConfig = { options: { dryRun: true }, categories: {} };
      await fs.writeFile(join(TEST_DIR_INIT, ".bundir.json"), JSON.stringify(existingConfig));

      await initCommand();

      const content = await fs.readFile(join(TEST_DIR_INIT, ".bundir.json"), "utf-8");
      const config = JSON.parse(content);
      expect(config.options.dryRun).toBe(true);
    });
  });
});

describe("integration - config loading", () => {
  const TEST_DIR_CONFIG = join(process.cwd(), "test-config-workspace");

  beforeEach(async () => {
    await fs.rm(TEST_DIR_CONFIG, { recursive: true, force: true });
    await fs.mkdir(TEST_DIR_CONFIG, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR_CONFIG, { recursive: true, force: true });
  });

  it(
    "should use default config when no config file exists",
    withChdir(TEST_DIR_CONFIG, async () => {
      const config = await loadConfig({});

      expect(config.options.defaultCategory).toBe("others");
      expect(config.options.conflictResolution).toBe("skip");
      expect(config.options.dryRun).toBe(false);
    })
  );

  it(
    "should override options with CLI flags",
    withChdir(TEST_DIR_CONFIG, async () => {
      const config = await loadConfig({ dryRun: true, defaultCategory: "misc" });

      expect(config.options.dryRun).toBe(true);
      expect(config.options.defaultCategory).toBe("misc");
      expect(config.options.conflictResolution).toBe("skip");
    })
  );

  it(
    "should load and merge local config with CLI overrides",
    withChdir(TEST_DIR_CONFIG, async () => {
      const localConfig = createConfig({
        options: { defaultCategory: "misc", verbose: true },
        categories: {
          custom: { extensions: [".custom"], targetDir: "custom-files" },
        },
      });
      await fs.writeFile(join(TEST_DIR_CONFIG, ".bundir.json"), JSON.stringify(localConfig, null, 2));

      const config = await loadConfig({ dryRun: true });

      expect(config.options.dryRun).toBe(true);
      expect(config.options.defaultCategory).toBe("misc");
      expect(config.options.verbose).toBe(true);
      expect(config.categories.custom).toBeDefined();
      expect(config.categories.custom?.extensions).toContain(".custom");
    })
  );

  it(
    "should handle invalid JSON config gracefully",
    withChdir(TEST_DIR_CONFIG, async () => {
      await fs.writeFile(join(TEST_DIR_CONFIG, ".bundir.json"), "not valid json");

      const config = await loadConfig({});

      expect(config.options.defaultCategory).toBe("others");
      expect(config.options.conflictResolution).toBe("skip");
    })
  );

  it(
    "should not crash when categories config is missing partial data",
    withChdir(TEST_DIR_CONFIG, async () => {
      const malformedConfig = JSON.stringify({
        options: { dryRun: true },
      });
      await fs.writeFile(join(TEST_DIR_CONFIG, ".bundir.json"), malformedConfig);

      const config = await loadConfig({});

      expect(config.options.dryRun).toBe(true);
    })
  );

  it("should create extension map correctly from loaded categories", async () => {
    const categories: OrganizerConfig["categories"] = {
      images: { extensions: [".png", ".jpg"], targetDir: "pics" },
      docs: { extensions: [".pdf"], targetDir: "papers" },
    };

    const map = createExtensionMap(categories);
    expect(map[".png"]).toBe("pics");
    expect(map[".jpg"]).toBe("pics");
    expect(map[".pdf"]).toBe("papers");
    expect(map[".zip"]).toBeUndefined();
  });
});
