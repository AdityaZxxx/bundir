import type { OrganizerConfig } from "./types";
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
      extensions: [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp", ".ico", ".avif"],
      targetDir: "media/images",
    },
    videos: {
      extensions: [".mp4", ".mkv", ".mov", ".avi", ".wmv", ".flv", ".webm", ".m4v"],
      targetDir: "media/videos",
    },
    audio: {
      extensions: [".mp3", ".wav", ".ogg", ".flac", ".aac", ".wma", ".m4a", ".opus"],
      targetDir: "media/audio",
    },
    documents: {
      extensions: [".pdf", ".docx", ".txt", ".md", ".odt", ".rtf", ".log"],
      targetDir: "documents",
    },
    spreadsheets: {
      extensions: [".xlsx", ".xls", ".csv", ".ods"],
      targetDir: "data/spreadsheets",
    },
    presentations: {
      extensions: [".ppt", ".pptx", ".key", ".odp", ".pps"],
      targetDir: "presentations",
    },
    archives: {
      extensions: [".zip", ".rar", ".tar", ".gz", ".7z", ".bz2", ".xz", ".zst", ".tgz", ".cab"],
      targetDir: "archives",
    },
    scripts: {
      extensions: [".js", ".ts", ".py", ".sh", ".rb", ".php", ".pl", ".swift"],
      targetDir: "code/scripts",
    },
    executables: {
      extensions: [".deb", ".rpm", ".AppImage", ".exe", ".msi", ".dmg", ".apk", ".pkg", ".run"],
      targetDir: "executables",
    },
    configs: {
      extensions: [".json", ".yaml", ".yml", ".toml", ".ini", ".env", ".cfg"],
      targetDir: "configs",
    },
    design: {
      extensions: [".fig", ".psd", ".ai", ".xd", ".sketch"],
      targetDir: "design",
    },
    ebooks: {
      extensions: [".epub", ".mobi", ".azw3", ".cbr", ".cbz"],
      targetDir: "ebooks",
    },
    fonts: {
      extensions: [".ttf", ".otf", ".woff", ".woff2", ".eot"],
      targetDir: "fonts",
    },
    discs: {
      extensions: [".iso", ".img", ".vcd", ".nrg"],
      targetDir: "discs",
    },
    databases: {
      extensions: [".sql", ".sqlite", ".db", ".sqlite3"],
      targetDir: "data/databases",
    },
    certificates: {
      extensions: [".pem", ".crt", ".cert", ".p12", ".pfx"],
      targetDir: "certificates",
    },
  },
};

async function readConfigFile(path: string): Promise<Partial<OrganizerConfig> | null> {
  const file = Bun.file(path);
  const exists = await file.exists();
  if (!exists) return null;

  try {
    const configData = await file.text();
    const parsed = JSON.parse(configData);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
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
