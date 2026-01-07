import type { OrganizerConfig } from "./types";
import { promises as fs } from "fs";
import { join } from "path";
import { homedir } from "os";

// --- Constants ---

export const CONFIG_FILE_NAME = ".bundir.json";

export const DEFAULT_CONFIG: OrganizerConfig = {
  options: {
    dryRun: false,
    verbose: true,
    defaultCategory: "others",
    ignoreHidden: true,
    conflictResolution: "skip",
    recursive: false,
  },
  categories: {
    images: {
      extensions: [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"],
      targetDir: "media/images",
    },
    documents: {
      extensions: [".pdf", ".docx", ".txt", ".md"],
      targetDir: "documents",
    },
  },
};

// --- Configuration Logic ---

/**
 * Reads a JSON configuration file from the specified path and parses it.
 *
 * @param path - The absolute or relative path to the JSON configuration file.
 * @returns A promise that resolves to a partial configuration object if file exists and
 *          contains valid JSON, or `null` if file is not found or contains invalid JSON.
 *
 * @example
 * ```ts
 * const config = await readConfigFile("/home/user/.bundir.json");
 * if (config) {
 *   console.log("Config loaded:", config.categories);
 * }
 * ```
 */
async function readConfigFile(path: string): Promise<Partial<OrganizerConfig> | null> {
  try {
    const configData = await fs.readFile(path, "utf-8");
    return JSON.parse(configData);
  } catch {
    return null; // File not found or invalid JSON
  }
}

/**
 * Loads and merges configuration from multiple sources in order of priority.
 *
 * Configuration sources are merged in the following order (later sources override earlier ones):
 * 1. Default configuration (hardcoded in application)
 * 2. Global configuration from `~/.bundir.json`
 * 3. Local configuration from `./.bundir.json`
 * 4. CLI options (highest priority)
 *
 * @param cliOptions - Optional CLI-provided options to override all other configuration sources.
 *                    Can be a partial object containing any subset of `options` fields.
 * @returns A promise that resolves to the complete merged configuration object.
 *
 * @example
 * ```ts
 * const config = await loadConfig({ dryRun: true, verbose: true });
 * console.log(config.options); // Shows merged options with CLI overrides applied
 * ```
 */
export async function loadConfig(cliOptions: Partial<OrganizerConfig["options"]>): Promise<OrganizerConfig> {
  let finalConfig = { ...DEFAULT_CONFIG };

  // 1. Load global config
  const globalPath = join(homedir(), CONFIG_FILE_NAME);
  const globalConfig = await readConfigFile(globalPath);
  if (globalConfig) {
    finalConfig = {
      options: { ...finalConfig.options, ...globalConfig.options },
      categories: { ...finalConfig.categories, ...globalConfig.categories },
    };
    console.log(`[OK] Loaded global config from ${globalPath}`);
  }

  // 2. Load local config (overrides global)
  const localPath = join(process.cwd(), CONFIG_FILE_NAME);
  const localConfig = await readConfigFile(localPath);
  if (localConfig) {
    finalConfig = {
      options: { ...finalConfig.options, ...localConfig.options },
      categories: { ...finalConfig.categories, ...localConfig.categories },
    };
    console.log(`[OK] Loaded local config from ${localPath}`);
  }

  // 3. Apply CLI options (highest priority)
  const cliOverrides = Object.fromEntries(Object.entries(cliOptions).filter(([, value]) => value !== undefined));
  finalConfig.options = { ...finalConfig.options, ...cliOverrides };

  return finalConfig;
}

/**
 * Creates a lookup map from file extensions to target directory paths.
 *
 * Converts the categories configuration into a key-value mapping where each file
 * extension maps to its corresponding target directory. Extensions are normalized
 * to lowercase for case-insensitive matching.
 *
 * @param categories - The categories configuration object containing extension mappings.
 *                   Each category has `extensions` array and `targetDir` path.
 * @returns An object mapping file extensions (with leading dot) to directory paths.
 *
 * @example
 * ```ts
 * const categories = {
 *   images: { extensions: [".png", ".jpg"], targetDir: "media/images" }
 * };
 * const map = createExtensionMap(categories);
 * console.log(map[".png"]); // "media/images"
 * console.log(map[".jpg"]); // "media/images"
 * ```
 */
export function createExtensionMap(categories: OrganizerConfig["categories"]): Record<string, string> {
  const extensionMap: Record<string, string> = {};
  for (const categoryKey in categories) {
    const category = categories[categoryKey];
    if (category) {
      const { extensions, targetDir } = category;
      for (const ext of extensions) {
        extensionMap[ext.toLowerCase()] = targetDir;
      }
    }
  }
  return extensionMap;
}
