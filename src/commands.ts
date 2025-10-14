import { promises as fs } from "fs";
import { join, extname, parse, resolve } from "path";
import { loadConfig, createExtensionMap, DEFAULT_CONFIG, CONFIG_FILE_NAMES } from "./config";
import type { OrganizerConfig } from "./types";


/**
 * Checks if a file exists at a given path.
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
 * Recursively walks a directory and returns a flat list of all file paths.
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
  } catch (error: any) {
    console.error(`❌ Could not read directory ${dirPath}: ${error.message}`);
  }
  return filePaths;
}

/**
 * Action for the 'init' command. Creates a default config file.
 */
export async function initCommand() {
  const configPath = join(process.cwd(), CONFIG_FILE_NAMES[0]!);
  try {
    await fs.access(configPath);
    console.log(`⚠️ Config file already exists at ${configPath}.`);
  } catch {
    await fs.writeFile(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
    console.log(`✅ Created default config file at ${configPath}`);
  }
}

/**
 * Action for the 'organize' command.
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
    console.log("🧪 Running in dry-run mode. No files will be moved.");
  }

  try {
    let filesToProcess: string[] = [];
    if (recursive) {
      filesToProcess = await getAllFilePaths(absoluteBasePath);
    } else {
      const files = await fs.readdir(absoluteBasePath);
      filesToProcess = files.map(file => join(absoluteBasePath, file));
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
                console.log(`⚠️ [skip] ${file} already exists in ${targetDirName}.`);
              }
              continue;
            } else if (conflictResolution === "overwrite") {
              stats.conflictsOverwritten++;
              if (verbose) {
                console.log(`💥 [overwrite] ${file} in ${targetDirName}.`);
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
                console.log(`✍️ [rename] ${file} to ${parse(renamedFilePath).base}`);
              }
              await fs.rename(filePath, renamedFilePath);
              moves.push({ from: filePath, to: renamedFilePath });
              stats.filesMoved++;
            }
          }
        }

        if (verbose) {
          console.log(
            `${dryRun ? "🧪 [dry-run]" : "📁"} ${file} → ${targetDirName}`
          );
        }
      } catch (fileError: any) {
        stats.errors++;
        console.error(`❌ Error processing file ${file}:`, fileError.message);
      }
    }
  } catch (dirError: any) {
    stats.errors++;
    console.error(`❌ Failed to read directory ${path}:`, dirError.message);
  }

  const duration = (Date.now() - startTime) / 1000;
  console.log("\n✨ Organization Complete! ✨");
  console.log("-------------------------");
  console.log(`Processed:    ${stats.filesProcessed} files`);
  console.log(`Moved:          ${stats.filesMoved} files`);
  console.log(`Dirs created:   ${stats.directoriesCreated}`);
  console.log(`Conflicts:      ${stats.conflictsSkipped} skipped, ${stats.conflictsOverwritten} overwritten, ${stats.conflictsRenamed} renamed`);
  console.log(`Errors:         ${stats.errors}`);
  console.log(`Time taken:     ${duration.toFixed(2)}s`);
  console.log("-------------------------");

  if (moves.length > 0 && !dryRun) {
    try {
      const undoLogPath = join(process.cwd(), ".bundir-undo.log");
      await fs.writeFile(undoLogPath, JSON.stringify(moves, null, 2));
      if (verbose) {
        console.log(`ℹ️ Undo log saved to ${undoLogPath}`);
      }
    } catch (error: any) {
      console.error("❌ Could not write undo log:", error.message);
    }
  }
}

/**
 * Action for the 'undo' command. Reverts the last organization.
 */
export async function undoCommand() {
  const undoLogPath = join(process.cwd(), ".bundir-undo.log");

  try {
    const logData = await fs.readFile(undoLogPath, "utf-8");
    const moves: { from: string; to: string }[] = JSON.parse(logData);

    if (!Array.isArray(moves) || moves.length === 0) {
      console.log("ℹ️ Undo log is empty or invalid. Nothing to do.");
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
        console.log(`⏪ ${parse(move.to).base} → ${originalDir}`);
        revertedCount++;
      } catch (error: any) {
        console.error(`❌ Could not revert move for ${parse(move.to).base}: ${error.message}`);
      }
    }

    // Clean up the undo log after a successful operation
    await fs.unlink(undoLogPath);

    console.log(`\n✨ Undo complete. ${revertedCount} files moved back.`);

  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log("ℹ️ No undo log found. Nothing to revert.");
    } else {
      console.error("❌ An error occurred during the undo operation:", error.message);
    }
  }
}
