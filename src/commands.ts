import { extname, join, parse, resolve } from "path";
import { readdir, mkdir, rename, stat } from "fs/promises";
import { CONFIG_FILE_NAME, createExtensionMap, DEFAULT_CONFIG, loadConfig } from "./config";
import { FileSystemError, toErrorMessage } from "./errors";
import { logger } from "./logger";
import type { OrganizerConfig } from "./types";

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function getAllFilePaths(dirPath: string): Promise<string[]> {
  const filePaths: string[] = [];
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        filePaths.push(...(await getAllFilePaths(fullPath)));
      } else if (!entry.isSymbolicLink()) {
        filePaths.push(fullPath);
      }
    }
  } catch (error: unknown) {
    logger.error(`Could not read directory ${dirPath}: ${toErrorMessage(error)}`);
  }
  return filePaths;
}

export async function initCommand() {
  const configPath = join(process.cwd(), CONFIG_FILE_NAME);
  const exists = await Bun.file(configPath).exists();
  if (exists) {
    logger.warn(`Config file already exists at ${configPath}.`);
  } else {
    await Bun.write(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
    logger.ok(`Created default config file at ${configPath}`);
  }
}

export async function organizeCommand(path: string, cliOptions: Partial<OrganizerConfig["options"]>) {
  const startTime = performance.now();
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

  if (!path || path.trim().length === 0) {
    throw new FileSystemError("Target directory path cannot be empty.", ".", "FS_INVALID_PATH");
  }

  const config = await loadConfig(cliOptions);
  const { dryRun, verbose, defaultCategory, ignoreHidden, conflictResolution, recursive } = config.options;
  const extensionMap = createExtensionMap(config.categories);
  const createdDirs = new Set<string>();

  const absoluteBasePath = resolve(path);

  const baseExists = await fileExists(absoluteBasePath);
  if (!baseExists) {
    throw FileSystemError.notFound(absoluteBasePath);
  }

  logger.info(`Starting organization in ${absoluteBasePath}${recursive ? " (Recursive Mode)" : ""}`);
  if (dryRun) {
    logger.test("Dry-run mode. No files will be moved.");
  }

  try {
    let filesToProcess: string[] = [];
    if (recursive) {
      filesToProcess = await getAllFilePaths(absoluteBasePath);
    } else {
      const entries = await readdir(absoluteBasePath, { withFileTypes: true });
      filesToProcess = entries
        .filter((e) => !e.isDirectory() && !e.isSymbolicLink())
        .map((e) => join(absoluteBasePath, e.name));
    }

    for (const filePath of filesToProcess) {
      stats.filesProcessed++;
      const file = parse(filePath).base;
      if (ignoreHidden && file.startsWith(".")) continue;

      try {
        const fileStat = await stat(filePath);
        if (fileStat.isDirectory()) continue;

        const ext = extname(file).toLowerCase();
        const targetDirName = extensionMap[ext] || defaultCategory;
        const fileDir = parse(filePath).dir;
        const targetDir = join(fileDir, targetDirName);

        if (!createdDirs.has(targetDir)) {
          await mkdir(targetDir, { recursive: true });
          stats.directoriesCreated++;
          createdDirs.add(targetDir);
        }

        const newFilePath = join(targetDir, file);
        if (filePath === newFilePath) continue;

        if (!dryRun) {
          const destinationExists = await fileExists(newFilePath);

          if (!destinationExists) {
            await rename(filePath, newFilePath);
            moves.push({ from: filePath, to: newFilePath });
            stats.filesMoved++;
          } else if (conflictResolution === "skip") {
            stats.conflictsSkipped++;
            if (verbose) logger.warn(`[skip] ${file} already exists in ${targetDirName}.`);
            continue;
          } else if (conflictResolution === "overwrite") {
            stats.conflictsOverwritten++;
            if (verbose) logger.info(`[overwrite] ${file} in ${targetDirName}.`);
            await rename(filePath, newFilePath);
            moves.push({ from: filePath, to: newFilePath });
            stats.filesMoved++;
          } else if (conflictResolution === "rename") {
            stats.conflictsRenamed++;
            let counter = 1;
            let renamedFilePath;
            const { dir, name, ext: parsedExt } = parse(newFilePath);

            do {
              renamedFilePath = join(dir, `${name} (${counter})${parsedExt}`);
              counter++;
            } while (await fileExists(renamedFilePath));

            if (verbose) logger.info(`[rename] ${file} → ${parse(renamedFilePath).base}`);
            await rename(filePath, renamedFilePath);
            moves.push({ from: filePath, to: renamedFilePath });
            stats.filesMoved++;
          }
        }

        if (verbose) {
          const prefix = dryRun ? "[dry-run]" : "";
          logger.move(`${prefix} ${file} → ${targetDirName}`);
        }
      } catch (fileError: unknown) {
        stats.errors++;
        logger.error(`Error processing ${file}: ${toErrorMessage(fileError)}`);
      }
    }
  } catch (dirError: unknown) {
    stats.errors++;
    logger.error(`Failed to read directory ${path}: ${toErrorMessage(dirError)}`);
  }

  const duration = (performance.now() - startTime) / 1000;
  logger.header("Organization Complete");
  logger.dim(`Processed:      ${stats.filesProcessed} files`);
  logger.dim(`Moved:          ${stats.filesMoved} files`);
  logger.dim(`Directories:    ${stats.directoriesCreated}`);
  logger.dim(
    `Conflicts:      ${stats.conflictsSkipped} skipped, ${stats.conflictsOverwritten} overwritten, ${stats.conflictsRenamed} renamed`
  );
  logger.dim(`Errors:         ${stats.errors}`);
  logger.dim(`Time:           ${duration.toFixed(2)}s`);

  if (moves.length > 0 && !dryRun) {
    try {
      const undoLogPath = join(process.cwd(), ".bundir-undo.log");
      await Bun.write(undoLogPath, JSON.stringify(moves, null, 2));
      if (verbose) logger.info(`Undo log saved to ${undoLogPath}`);
    } catch (error: unknown) {
      logger.error(`Could not write undo log: ${toErrorMessage(error)}`);
    }
  }
}

export async function undoCommand() {
  const undoLogPath = join(process.cwd(), ".bundir-undo.log");

  try {
    const logData = await Bun.file(undoLogPath).text();
    const moves: { from: string; to: string }[] = JSON.parse(logData);

    if (!Array.isArray(moves) || moves.length === 0) {
      logger.info("Undo log is empty or invalid. Nothing to do.");
      return;
    }

    logger.info(`Found ${moves.length} moves to revert. Starting undo...`);

    let revertedCount = 0;
    for (const move of moves.slice().toReversed()) {
      try {
        const originalDir = parse(move.from).dir;
        await mkdir(originalDir, { recursive: true });
        await rename(move.to, move.from);
        logger.info(`${parse(move.to).base} → ${originalDir}`);
        revertedCount++;
      } catch (error: unknown) {
        logger.error(`Could not revert ${parse(move.to).base}: ${toErrorMessage(error)}`);
      }
    }

    await Bun.file(undoLogPath).delete();
    logger.ok(`Undo complete. ${revertedCount} files moved back.`);
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      logger.info("No undo log found. Nothing to revert.");
    } else {
      logger.error(`Undo failed: ${toErrorMessage(error)}`);
    }
  }
}
