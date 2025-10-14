import { promises as fs } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { OrganizerConfig } from "./types";

// Configuration file names that the application looks for
export const CONFIG_FILE_NAMES = [".bundir.json", ".organizer.json"];

// Default configuration settings for the file organizer
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

/**
 * Reads a JSON config file and returns its content or null.
 */
async function readConfigFile(
  path: string
): Promise<Partial<OrganizerConfig> | null> {
  try {
    const configData = await fs.readFile(path, "utf-8");
    return JSON.parse(configData);
  } catch (error) {
    return null; // File not found or invalid JSON
  }
}

/**
 * Loads and merges configurations from multiple sources.
 * Priority: CLI > Local > Global > Defaults
 */
export async function loadConfig(
  cliOptions: Partial<OrganizerConfig["options"]>
): Promise<OrganizerConfig> {
  let finalConfig = { ...DEFAULT_CONFIG };

  // 1. Load global config
  for (const name of CONFIG_FILE_NAMES) {
    const globalPath = join(homedir(), name);
    const globalConfig = await readConfigFile(globalPath);
    if (globalConfig) {
      finalConfig = {
        options: { ...finalConfig.options, ...globalConfig.options },
        categories: { ...finalConfig.categories, ...globalConfig.categories },
      };
      console.log(`✅ Loaded global config from ${globalPath}`);
      break; // Stop after finding one
    }
  }

  // 2. Load local config (overrides global)
  for (const name of CONFIG_FILE_NAMES) {
    const localPath = join(process.cwd(), name);
    const localConfig = await readConfigFile(localPath);
    if (localConfig) {
      finalConfig = {
        options: { ...finalConfig.options, ...localConfig.options },
        categories: { ...finalConfig.categories, ...localConfig.categories },
      };
      console.log(`✅ Loaded local config from ${localPath}`);
      break; // Stop after finding one
    }
  }

  // 3. Apply CLI options (highest priority)
  const cliOverrides = Object.fromEntries(
    Object.entries(cliOptions).filter(([, value]) => value !== undefined)
  );
  finalConfig.options = { ...finalConfig.options, ...cliOverrides };

  return finalConfig;
}

/**
 * Creates a map from file extension to target directory for quick lookups.
 */
export function createExtensionMap(
  categories: OrganizerConfig["categories"]
): Record<string, string> {
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
