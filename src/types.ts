// Configuration interface for the file organizer
export interface OrganizerConfig {
  options: {
    dryRun: boolean;
    verbose: boolean;
    defaultCategory: string;
    ignoreHidden: boolean;
    conflictResolution: "skip" | "overwrite" | "rename";
    recursive: boolean;
  };
  categories: Record<string, { extensions: string[]; targetDir: string }>;
}
