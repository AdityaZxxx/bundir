export class BundirError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "BundirError";
  }
}

export class ConfigError extends BundirError {
  constructor(message: string, code = "CONFIG_ERROR") {
    super(message, code);
    this.name = "ConfigError";
  }

  static invalidJson(path: string, parseError: string): ConfigError {
    return new ConfigError(
      `Failed to parse config at ${path}: ${parseError}. Fix or delete the file.`,
      "CONFIG_INVALID_JSON"
    );
  }
}

export class FileSystemError extends BundirError {
  constructor(
    message: string,
    public readonly path: string,
    code = "FS_ERROR"
  ) {
    super(message, code);
    this.name = "FileSystemError";
  }

  static notFound(path: string): FileSystemError {
    return new FileSystemError(
      `Path not found: ${path}. Check that the directory exists and try again.`,
      path,
      "FS_NOT_FOUND"
    );
  }
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
