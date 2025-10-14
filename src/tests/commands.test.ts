// Tests for the command functions in commands.ts
// These tests verify that the organize and init commands work correctly

import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { promises as fs } from "fs";
import { join } from "path";
import { organizeCommand, undoCommand } from "../commands";
import * as config from "../config"; // Import the module to spy on it

describe("organizeCommand", () => {
  const TEST_DIR = join(process.cwd(), "test-workspace");

  beforeEach(async () => {
    // 1. Set up a clean test directory
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_DIR, { recursive: true });

    // 2. Spy on loadConfig and mock its implementation for every test
    spyOn(config, "loadConfig").mockImplementation(async (cliOptions: any) => {
      return {
        ...config.DEFAULT_CONFIG,
        options: { ...config.DEFAULT_CONFIG.options, ...cliOptions },
      };
    });
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it("should organize files into correct category directories in a basic run", async () => {
    // --- Setup ---
    await fs.writeFile(join(TEST_DIR, "image.png"), "");
    await fs.writeFile(join(TEST_DIR, "document.pdf"), "");
    await fs.writeFile(join(TEST_DIR, "archive.zip"), ""); // Should go to 'others'

    // --- Execute ---
    // organizeCommand will now use the mocked loadConfig from the spy
    await organizeCommand(TEST_DIR, {});

    // --- Assert ---
    const imagePath = join(TEST_DIR, "media/images", "image.png");
    const docPath = join(TEST_DIR, "documents", "document.pdf");
    const otherPath = join(TEST_DIR, "others", "archive.zip");

    // A slightly cleaner way to check for file existence
    expect(await fs.exists(imagePath)).toBe(true);
    expect(await fs.exists(docPath)).toBe(true);
    expect(await fs.exists(otherPath)).toBe(true);

    // Check if original files were removed
    expect(await fs.exists(join(TEST_DIR, "image.png"))).toBe(false);
    expect(await fs.exists(join(TEST_DIR, "document.pdf"))).toBe(false);
    expect(await fs.exists(join(TEST_DIR, "archive.zip"))).toBe(false);
  });

  it("should skip files when conflictResolution is 'skip' and destination exists", async () => {
    // --- Setup ---
    const sourceFilePath = join(TEST_DIR, "image.png");
    const destDir = join(TEST_DIR, "media/images");
    const destFilePath = join(destDir, "image.png");

    // Create the source file
    await fs.writeFile(sourceFilePath, "source file");
    // Create the destination directory and a conflicting file
    await fs.mkdir(destDir, { recursive: true });
    await fs.writeFile(destFilePath, "destination file");

    // --- Execute ---
    await organizeCommand(TEST_DIR, { conflictResolution: "skip" });

    // --- Assert ---
    // Source file should NOT have been moved
    expect(await fs.exists(sourceFilePath)).toBe(true);

    // Destination file should be untouched (we can check its content)
    const destContent = await fs.readFile(destFilePath, "utf-8");
    expect(destContent).toBe("destination file");
  });

  it("should overwrite files when conflictResolution is 'overwrite'", async () => {
    // --- Setup ---
    const sourceFilePath = join(TEST_DIR, "image.png");
    const destDir = join(TEST_DIR, "media/images");
    const destFilePath = join(destDir, "image.png");

    await fs.writeFile(sourceFilePath, "source file content");
    await fs.mkdir(destDir, { recursive: true });
    await fs.writeFile(destFilePath, "initial destination content");

    // --- Execute ---
    await organizeCommand(TEST_DIR, { conflictResolution: "overwrite" });

    // --- Assert ---
    // Source file should be gone
    expect(await fs.exists(sourceFilePath)).toBe(false);

    // Destination file should now have the content of the source file
    const destContent = await fs.readFile(destFilePath, "utf-8");
    expect(destContent).toBe("source file content");
  });

  it("should rename files when conflictResolution is 'rename'", async () => {
    // --- Setup ---
    const sourceFilePath = join(TEST_DIR, "image.png");
    const destDir = join(TEST_DIR, "media/images");
    const originalDestPath = join(destDir, "image.png");
    const renamedDestPath = join(destDir, "image (1).png");

    await fs.writeFile(sourceFilePath, "source content");
    await fs.mkdir(destDir, { recursive: true });
    await fs.writeFile(originalDestPath, "original destination content");

    // --- Execute ---
    await organizeCommand(TEST_DIR, { conflictResolution: "rename" });

    // --- Assert ---
    // Source file should be gone
    expect(await fs.exists(sourceFilePath)).toBe(false);

    // Original destination file should be untouched
    const originalContent = await fs.readFile(originalDestPath, "utf-8");
    expect(originalContent).toBe("original destination content");

    // A new, renamed file should exist
    expect(await fs.exists(renamedDestPath)).toBe(true);
  });

  it("should organize files recursively when recursive mode is enabled", async () => {
    // --- Setup ---
    const subDir = join(TEST_DIR, "subfolder");
    await fs.mkdir(subDir, { recursive: true });

    // Create files at different levels
    await fs.writeFile(join(TEST_DIR, "root-image.png"), "");
    await fs.writeFile(join(subDir, "sub-doc.pdf"), "");

    // --- Execute ---
    await organizeCommand(TEST_DIR, { recursive: true });

    // --- Assert ---
    const rootImagePath = join(TEST_DIR, "media/images", "root-image.png");
    const subDocPath = join(subDir, "documents", "sub-doc.pdf");

    // Check that files were moved to the correct locations within their original directory structure
    expect(await fs.exists(rootImagePath)).toBe(true);
    expect(await fs.exists(subDocPath)).toBe(true);

    // Check that original files are gone
    expect(await fs.exists(join(TEST_DIR, "root-image.png"))).toBe(false);
    expect(await fs.exists(join(subDir, "sub-doc.pdf"))).toBe(false);
  });

  it("should handle edge cases like hidden files and already organized files", async () => {
    // --- Setup ---
    const hiddenFilePath = join(TEST_DIR, ".env");
    const alreadyOrganizedDir = join(TEST_DIR, "documents");
    const alreadyOrganizedFile = join(alreadyOrganizedDir, "report.pdf");

    await fs.writeFile(hiddenFilePath, "secret");
    await fs.mkdir(alreadyOrganizedDir, { recursive: true });
    await fs.writeFile(alreadyOrganizedFile, "report data");

    // --- Execute ---
    await organizeCommand(TEST_DIR, { ignoreHidden: true });

    // --- Assert ---
    // Hidden file should NOT be moved and should still exist at its original location
    expect(await fs.exists(hiddenFilePath)).toBe(true);
    const hiddenFileContent = await fs.readFile(hiddenFilePath, "utf-8");
    expect(hiddenFileContent).toBe("secret");

    // Already organized file should also be untouched
    expect(await fs.exists(alreadyOrganizedFile)).toBe(true);
    const reportContent = await fs.readFile(alreadyOrganizedFile, "utf-8");
    expect(reportContent).toBe("report data");
  });

  it("should correctly undo a previous organization operation", async () => {
    // --- Setup: Create initial files ---
    const imagePath = join(TEST_DIR, "image.png");
    const docPath = join(TEST_DIR, "document.pdf");
    await fs.writeFile(imagePath, "");
    await fs.writeFile(docPath, "");

    // --- 1. Organize ---
    await organizeCommand(TEST_DIR, {});

    // --- Assert organization happened ---
    const organizedImagePath = join(TEST_DIR, "media/images", "image.png");
    const organizedDocPath = join(TEST_DIR, "documents", "document.pdf");
    const undoLogPath = join(process.cwd(), ".bundir-undo.log");

    expect(await fs.exists(organizedImagePath)).toBe(true);
    expect(await fs.exists(organizedDocPath)).toBe(true);
    expect(await fs.exists(undoLogPath)).toBe(true); // Undo log must be created

    // --- 2. Undo ---
    await undoCommand();

    // --- Assert undo happened ---
    // Original files should be restored
    expect(await fs.exists(imagePath)).toBe(true);
    expect(await fs.exists(docPath)).toBe(true);

    // Organized files should be gone
    expect(await fs.exists(organizedImagePath)).toBe(false);
    expect(await fs.exists(organizedDocPath)).toBe(false);

    // Undo log should be deleted
    expect(await fs.exists(undoLogPath)).toBe(false);
  });
});
