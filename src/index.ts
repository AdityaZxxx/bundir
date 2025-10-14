#!/usr/bin/env bun

import { Command } from "commander";
import { initCommand, organizeCommand, undoCommand } from "./commands";
import { CONFIG_FILE_NAMES } from "./config";

// Initialize the command-line interface using Commander.js

const program = new Command();

program
  .name("bundir")
  .description("Organize files with Bun in a directory by type")
  .version("1.1.0");

program
  .command("init")
  .description(`Create a default ${CONFIG_FILE_NAMES[0]} file`)
  .action(initCommand);

program
  .command("undo")
  .description("Revert the last organization operation")
  .action(undoCommand);

program
  .command("organize", { isDefault: true })
  .description("Organize files in the target directory")
  .argument("[path]", "Target directory path", ".")
  .option("--dry-run [boolean]", "Simulate organization without moving files")
  .option("--verbose [boolean]", "Enable detailed logging")
  .option("--ignore-hidden [boolean]", "Ignore hidden files")
  .option(
    "--default-category <name>",
    "Default category for uncategorized files"
  )
  .option(
    "--conflict-resolution <mode>",
    "Conflict resolution mode: skip, overwrite, or rename"
  )
  .option("-r, --recursive", "Organize files in subdirectories recursively")
  .action(organizeCommand);

program.parse();
