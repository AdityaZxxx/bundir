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

  static missingField(path: string, field: string): ConfigError {
    return new ConfigError(`Config at ${path} is missing required field '${field}'.`, "CONFIG_MISSING_FIELD");
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

  static permissionDenied(path: string, operation: string): FileSystemError {
    return new FileSystemError(
      `Permission denied ${operation} ${path}. Check file permissions.`,
      path,
      "FS_PERMISSION_DENIED"
    );
  }

  static accessError(path: string, operation: string, detail: string): FileSystemError {
    return new FileSystemError(`Cannot ${operation} ${path}: ${detail}`, path, "FS_ACCESS_ERROR");
  }
}

export class OrganizeError extends BundirError {
  constructor(message: string, code = "ORGANIZE_ERROR") {
    super(message, code);
    this.name = "OrganizeError";
  }
}

export function formatError(error: unknown): string {
  if (error instanceof BundirError) {
    return `[${error.code}] ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
