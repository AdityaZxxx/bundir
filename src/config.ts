import type { OrganizerConfig } from "./types";
import { promises as fs } from "fs";
import { join } from "path";
import { homedir } from "os";
import { ConfigError } from "./errors";
import { logger } from "./logger";

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

async function readConfigFile(path: string): Promise<Partial<OrganizerConfig> | null> {
  try {
    const configData = await fs.readFile(path, "utf-8");
    const parsed = JSON.parse(configData);
    if (parsed && typeof parsed === "object") {
      validateConfigShape(parsed, path);
    }
    return parsed;
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      logger.warn(ConfigError.invalidJson(path, error.message).message);
    }
    return null;
  }
}

function validateConfigShape(config: Record<string, unknown>, source: string): void {
  if (config.options !== undefined) {
    const validKeys = ["dryRun", "verbose", "defaultCategory", "ignoreHidden", "conflictResolution", "recursive"];
    for (const key of Object.keys(config.options as Record<string, unknown>)) {
      if (!validKeys.includes(key)) {
        logger.warn(`Unknown option '${key}' in config at ${source}.`);
      }
    }
    const cr = (config.options as Record<string, unknown>)?.conflictResolution;
    if (cr !== undefined && !["skip", "overwrite", "rename"].includes(cr as string)) {
      logger.warn(
        `Invalid conflictResolution '${cr}' in ${source}. Must be 'skip', 'overwrite', or 'rename'. Using default.`
      );
    }
  }

  if (config.categories !== undefined) {
    const cats = config.categories as Record<string, unknown>;
    for (const [key, val] of Object.entries(cats)) {
      if (!val || typeof val !== "object") {
        logger.warn(`Category '${key}' in ${source} is not a valid object. Skipping.`);
        continue;
      }
      const cat = val as Record<string, unknown>;
      if (!Array.isArray(cat.extensions)) {
        logger.warn(`Category '${key}' in ${source} is missing 'extensions' array. Skipping.`);
      }
      if (typeof cat.targetDir !== "string" || cat.targetDir.trim().length === 0) {
        logger.warn(`Category '${key}' in ${source} is missing 'targetDir'. Skipping.`);
      }
    }
  }
}

export async function loadConfig(cliOptions: Partial<OrganizerConfig["options"]>): Promise<OrganizerConfig> {
  let finalConfig = { ...DEFAULT_CONFIG };

  const globalPath = join(homedir(), CONFIG_FILE_NAME);
  const globalConfig = await readConfigFile(globalPath);
  if (globalConfig) {
    finalConfig = {
      options: { ...finalConfig.options, ...globalConfig.options },
      categories: { ...finalConfig.categories, ...globalConfig.categories },
    };
    logger.ok(`Loaded global config from ${globalPath}`);
  }

  const localPath = join(process.cwd(), CONFIG_FILE_NAME);
  const localConfig = await readConfigFile(localPath);
  if (localConfig) {
    finalConfig = {
      options: { ...finalConfig.options, ...localConfig.options },
      categories: { ...finalConfig.categories, ...localConfig.categories },
    };
    logger.ok(`Loaded local config from ${localPath}`);
  }

  const cliOverrides = Object.fromEntries(Object.entries(cliOptions).filter(([, value]) => value !== undefined));
  finalConfig.options = { ...finalConfig.options, ...cliOverrides };

  return finalConfig;
}

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
