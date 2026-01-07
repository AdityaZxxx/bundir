import { promises as fs } from "fs";
import { extname, join, parse, resolve } from "path";
import { CONFIG_FILE_NAME, createExtensionMap, DEFAULT_CONFIG, loadConfig } from "./config";
import type { OrganizerConfig } from "./types";

/**
 * Checks if a file or directory exists at the specified path.
 *
 * @param path - The absolute or relative path to check for existence.
 * @returns A promise that resolves to `true` if the path exists, `false` otherwise.
 *
 * @example
 * ```ts
 * if (await fileExists("/path/to/file.txt")) {
 *   console.log("File exists");
 * }
 * ```
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Recursively walks through a directory and returns a flat list of all file paths.
 *
 * @param dirPath - The absolute or relative path to the directory to scan.
 * @returns A promise that resolves to an array of file paths found in the directory tree.
 *          Returns an empty array if the directory cannot be read.
 *
 * @example
 * ```ts
 * const files = await getAllFilePaths("/home/user/documents");
 * console.log(files); // ["/home/user/documents/file1.txt", "/home/user/documents/subfolder/file2.pdf"]
 * ```
 */
async function getAllFilePaths(dirPath: string): Promise<string[]> {
  let filePaths: string[] = [];
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        filePaths = filePaths.concat(await getAllFilePaths(fullPath));
      } else {
        filePaths.push(fullPath);
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[ERROR] Could not read directory ${dirPath}: ${errorMessage}`);
  }
  return filePaths;
}

/**
 * Initializes a new configuration file in the current working directory.
 * Creates a default `.bundir.json` file if one does not already exist.
 *
 * @throws Error if unable to write configuration file to disk.
 *
 * @example
 * ```bash
 * bundir init
 * # Output: Created default config file at /current/directory/.bundir.json
 * ```
 */
export async function initCommand() {
  const configPath = join(process.cwd(), CONFIG_FILE_NAME[0]!);
  try {
    await fs.access(configPath);
    console.log(`[WARN] Config file already exists at ${configPath}.`);
  } catch {
    await fs.writeFile(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
    console.log(`[OK] Created default config file at ${configPath}`);
  }
}

/**
 * Organizes files in a directory based on their extensions and configuration rules.
 *
 * Scans the specified directory and moves files into appropriate subdirectories based on
 * their file extensions. Supports recursive scanning, conflict resolution, and dry-run mode.
 *
 * @param path - The target directory path to organize. Defaults to current directory if not specified.
 * @param cliOptions - Optional CLI options to override configuration. Can include:
 *                    - `dryRun`: If true, simulate organization without making changes
 *                    - `verbose`: If true, display detailed logging for each operation
 *                    - `ignoreHidden`: If true, skip files starting with a dot
 *                    - `defaultCategory`: Category name for files with unrecognized extensions
 *                    - `conflictResolution`: Strategy for handling filename conflicts ("skip", "overwrite", "rename")
 *                    - `recursive`: If true, scan subdirectories recursively
 *
 * @throws Error if unable to read directory or write undo log file.
 *
 * @example
 * ```bash
 * # Organize current directory
 * bundir organize
 *
 * # Organize specific directory with options
 * bundir organize ~/Downloads --recursive --verbose
 *
 * # Preview changes without moving files
 * bundir organize --dry-run
 * ```
 */
export async function organizeCommand(path: string, cliOptions: Partial<OrganizerConfig["options"]>) {
  const startTime = Date.now();
  const moves: { from: string; to: string }[] = [];
  const stats = {
    filesProcessed: 0,
    filesMoved: 0,
    directoriesCreated: 0,
    conflictsSkipped: 0,
    conflictsOverwritten: 0,
    conflictsRenamed: 0,
    errors: 0,
  };

  const config = await loadConfig(cliOptions);
  const { dryRun, verbose, defaultCategory, ignoreHidden, conflictResolution, recursive } = config.options;
  const extensionMap = createExtensionMap(config.categories);
  const createdDirs = new Set<string>();

  // --- CRITICAL FIX: Resolve base path to be absolute from the start ---
  const absoluteBasePath = resolve(path);

  console.log(`Starting directory organization in ${absoluteBasePath}... ${recursive ? "(Recursive Mode)" : ""}`);
  if (dryRun) {
    console.log("[TEST] Running in dry-run mode. No files will be moved.");
  }

  try {
    let filesToProcess: string[] = [];
    if (recursive) {
      filesToProcess = await getAllFilePaths(absoluteBasePath);
    } else {
      const files = await fs.readdir(absoluteBasePath);
      filesToProcess = files.map((file) => join(absoluteBasePath, file));
    }

    for (const filePath of filesToProcess) {
      stats.filesProcessed++;
      const file = parse(filePath).base;
      if (ignoreHidden && file.startsWith(".")) continue;

      try {
        const fileStat = await fs.stat(filePath);
        if (fileStat.isDirectory()) continue;

        const ext = extname(file).toLowerCase();
        const targetDirName = extensionMap[ext] || defaultCategory;
        const fileDir = parse(filePath).dir;
        const targetDir = join(fileDir, targetDirName);

        if (!createdDirs.has(targetDir)) {
          await fs.mkdir(targetDir, { recursive: true });
          stats.directoriesCreated++;
          createdDirs.add(targetDir);
        }

        const newFilePath = join(targetDir, file);

        if (filePath === newFilePath) continue;

        if (!dryRun) {
          const destinationExists = await fileExists(newFilePath);

          if (!destinationExists) {
            await fs.rename(filePath, newFilePath);
            moves.push({ from: filePath, to: newFilePath });
            stats.filesMoved++;
          } else {
            if (conflictResolution === "skip") {
              stats.conflictsSkipped++;
              if (verbose) {
                console.log(`[WARN] [skip] ${file} already exists in ${targetDirName}.`);
              }
              continue;
            } else if (conflictResolution === "overwrite") {
              stats.conflictsOverwritten++;
              if (verbose) {
                console.log(`[OVERWRITE] ${file} in ${targetDirName}.`);
              }
              await fs.rename(filePath, newFilePath);
              moves.push({ from: filePath, to: newFilePath });
              stats.filesMoved++;
            } else if (conflictResolution === "rename") {
              stats.conflictsRenamed++;
              let counter = 1;
              let renamedFilePath;
              const { dir, name, ext } = parse(newFilePath);

              do {
                renamedFilePath = join(dir, `${name} (${counter})${ext}`);
                counter++;
              } while (await fileExists(renamedFilePath));

              if (verbose) {
                console.log(`[RENAME] ${file} to ${parse(renamedFilePath).base}`);
              }
              await fs.rename(filePath, renamedFilePath);
              moves.push({ from: filePath, to: renamedFilePath });
              stats.filesMoved++;
            }
          }
        }

        if (verbose) {
          console.log(`${dryRun ? "[TEST] [dry-run]" : "[MOVE]"} ${file} → ${targetDirName}`);
        }
      } catch (fileError: unknown) {
        stats.errors++;
        const errorMessage = fileError instanceof Error ? fileError.message : String(fileError);
        console.error(`[ERROR] Error processing file ${file}:`, errorMessage);
      }
    }
  } catch (dirError: unknown) {
    stats.errors++;
    const errorMessage = dirError instanceof Error ? dirError.message : String(dirError);
    console.error(`[ERROR] Failed to read directory ${path}:`, errorMessage);
  }

  const duration = (Date.now() - startTime) / 1000;
  console.log("\nOrganization Complete!");
  console.log("-------------------------");
  console.log(`Processed:      ${stats.filesProcessed} files`);
  console.log(`Moved:          ${stats.filesMoved} files`);
  console.log(`Dirs created:   ${stats.directoriesCreated}`);
  console.log(
    `Conflicts:      ${stats.conflictsSkipped} skipped, ${stats.conflictsOverwritten} overwritten, ${stats.conflictsRenamed} renamed`
  );
  console.log(`Errors:         ${stats.errors}`);
  console.log(`Time taken:     ${duration.toFixed(2)}s`);
  console.log("-------------------------");

  if (moves.length > 0 && !dryRun) {
    try {
      const undoLogPath = join(process.cwd(), ".bundir-undo.log");
      await fs.writeFile(undoLogPath, JSON.stringify(moves, null, 2));
      if (verbose) {
        console.log(`[INFO] Undo log saved to ${undoLogPath}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[ERROR] Could not write undo log:", errorMessage);
    }
  }
}

/**
 * Reverts the most recent file organization operation.
 *
 * Reads the `.bundir-undo.log` file created by the last organization command
 * and moves all files back to their original locations. The undo log file is
 * deleted after successful completion.
 *
 * @throws Error if unable to read undo log file or move files.
 *
 * @example
 * ```bash
 * bundir undo
 * # Output: Found 5 moves to revert. Starting undo...
 * #         Undo complete. 5 files moved back.
 * ```
 */
export async function undoCommand() {
  const undoLogPath = join(process.cwd(), ".bundir-undo.log");

  try {
    const logData = await fs.readFile(undoLogPath, "utf-8");
    const moves: { from: string; to: string }[] = JSON.parse(logData);

    if (!Array.isArray(moves) || moves.length === 0) {
      console.log("[INFO] Undo log is empty or invalid. Nothing to do.");
      return;
    }

    console.log(`Found ${moves.length} moves to revert. Starting undo...`);

    let revertedCount = 0;
    // Revert moves in reverse order
    for (const move of moves.slice().reverse()) {
      try {
        // Ensure the destination directory exists before moving the file back
        const originalDir = parse(move.from).dir;
        await fs.mkdir(originalDir, { recursive: true });

        await fs.rename(move.to, move.from);
        console.log(`[UNDO] ${parse(move.to).base} → ${originalDir}`);
        revertedCount++;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[ERROR] Could not revert move for ${parse(move.to).base}: ${errorMessage}`);
      }
    }

    // Clean up the undo log after a successful operation
    await fs.unlink(undoLogPath);

    console.log(`\nUndo complete. ${revertedCount} files moved back.`);
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      console.log("[INFO] No undo log found. Nothing to revert.");
    } else {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[ERROR] An error occurred during the undo operation:", errorMessage);
    }
  }
}
