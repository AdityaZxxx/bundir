import { promises as fs } from "fs";
import { extname, join, parse } from "path";
import {
  CONFIG_FILE_NAMES,
  createExtensionMap,
  DEFAULT_CONFIG,
  loadConfig,
} from "./config";
import type { OrganizerConfig } from "./types";

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
 * Action for the 'organize' command.
 */
export async function organizeCommand(
  path: string,
  cliOptions: Partial<OrganizerConfig["options"]>
) {
  const startTime = Date.now();
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
  const {
    dryRun,
    verbose,
    defaultCategory,
    ignoreHidden,
    conflictResolution,
    recursive,
  } = config.options;
  const extensionMap = createExtensionMap(config.categories);
  const createdDirs = new Set<string>();

  console.log(
    `Starting directory organization... ${recursive ? "(Recursive Mode)" : ""}`
  );
  if (dryRun) {
    console.log("🧪 Running in dry-run mode. No files will be moved.");
  }

  try {
    let filesToProcess: string[] = [];
    if (recursive) {
      filesToProcess = await getAllFilePaths(path);
    } else {
      const files = await fs.readdir(path);
      filesToProcess = files.map((file) => join(path, file));
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
            stats.filesMoved++;
          } else {
            if (conflictResolution === "skip") {
              stats.conflictsSkipped++;
              if (verbose) {
                console.log(
                  `⚠️ [skip] ${file} already exists in ${targetDirName}.`
                );
              }
              continue;
            } else if (conflictResolution === "overwrite") {
              stats.conflictsOverwritten++;
              if (verbose) {
                console.log(`💥 [overwrite] ${file} in ${targetDirName}.`);
              }
              await fs.rename(filePath, newFilePath);
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
                console.log(
                  `✍️ [rename] ${file} to ${parse(renamedFilePath).base}`
                );
              }
              await fs.rename(filePath, renamedFilePath);
              stats.filesMoved++;
            }
          }
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
  console.log(`Processed:      ${stats.filesProcessed} files`);
  console.log(`Moved:          ${stats.filesMoved} files`);
  console.log(`Dirs created:   ${stats.directoriesCreated}`);
  console.log(
    `Conflicts:      ${stats.conflictsSkipped} skipped, ${stats.conflictsOverwritten} overwritten, ${stats.conflictsRenamed} renamed`
  );
  console.log(`Errors:         ${stats.errors}`);
  console.log(`Time taken:     ${duration.toFixed(2)}s`);
  console.log("-------------------------");
}
