#!/usr/bin/env bun

import { Command } from "commander";
import { initCommand, organizeCommand, undoCommand } from "./commands";
import { CONFIG_FILE_NAME } from "./config";

const program = new Command();

program
  .name("bundir")
  .description("Organize files in a directory by type")
  .version("1.1.0")
  .addHelpText(
    "after",
    `
Examples:
  bundir                          Organize current directory
  bundir ~/Downloads              Organize a specific directory
  bundir --dry-run                Preview changes without moving files
  bundir --recursive              Organize subdirectories too
  bundir --conflict-resolution rename  Rename duplicates instead of skipping
  bundir --ignore-hidden false    Also move hidden files (dotfiles)
  bundir init                     Create a default .bundir.json config
  bundir undo                     Revert the last organization

Configuration:
  Create .bundir.json in your project or home directory (~/) to set rules.
  See: https://github.com/AdityaZxxx/bundir#configuration
`
  );

program.command("init").description(`Create a default ${CONFIG_FILE_NAME} file`).action(initCommand);

program.command("undo").description("Revert the last organization operation").action(undoCommand);

program
  .command("organize", { isDefault: true })
  .description("Organize files in the target directory")
  .argument("[path]", "Target directory path", ".")
  .option("--dry-run", "Simulate organization without moving files")
  .option("--verbose", "Enable detailed logging")
  .option("--ignore-hidden", "Ignore hidden files (dotfiles)")
  .option("--default-category <name>", "Folder name for uncategorized files")
  .option("--conflict-resolution <mode>", "How to handle filename conflicts: skip, overwrite, or rename")
  .option("-r, --recursive", "Organize files in subdirectories recursively")
  .action(organizeCommand);

program.parse();
