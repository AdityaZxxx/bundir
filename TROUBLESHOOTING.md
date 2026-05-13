# Troubleshooting Guide

## Common Issues

### `bundir: command not found`

The CLI is not installed globally.

```bash
# Install from npm
npm install -g bundir

# Or link local build
bun link
```

### Files are not being moved

1. **Dry-run mode is enabled** — check your `.bundir.json` options:

   ```json
   { "options": { "dryRun": false } }
   ```

   Or omit the `--dry-run` flag.

2. **Files are already organized** — bundir skips files that are already in their target category directory.

3. **Hidden files** — files starting with `.` are ignored by default. Use `--ignore-hidden false` to include them.

4. **Wrong directory** — specify the target directory:
   ```bash
   bundir /path/to/messy/folder
   ```

### Files are going to the wrong folder

1. **Check your `.bundir.json`** — the extension might not be listed in any category:
   ```json
   {
     "categories": {
       "images": { "extensions": [".png", ".jpg"], "targetDir": "my-images" }
     }
   }
   ```
2. **Uncategorized files** go to the `defaultCategory` folder (default: `others`).

### `bundir undo` does nothing

1. No previous `bundir organize` was run, or the undo log was deleted.
2. The undo log (`.bundir-undo.log`) only stores the **most recent** operation.
3. Undo works by reading `.bundir-undo.log` in the current working directory — run it from the same directory where you ran `organize`.

### Conflict resolution is not working as expected

- **`skip`** — keeps both files (new file stays at root, old file stays in target)
- **`overwrite`** — replaces the target file with the new one
- **`rename`** — appends `(1)`, `(2)`, etc. to the new file's name

### Permission errors

bundir needs read/write access to the directory being organized. Run with appropriate permissions:

```bash
sudo bundir /restricted/directory
```

### Performance with large directories

For directories with 10,000+ files, organize might take a few seconds. This is expected — each file needs to be read, categorized, and moved.

### Config file is ignored

bundir loads configs in this priority order (highest wins):

1. CLI flags (`--dry-run`, `--verbose`, etc.)
2. Local `.bundir.json` (in current directory)
3. Global `~/.bundir.json`
4. Built-in defaults

If a CLI flag is set, it overrides the config file.

## Getting Help

- Open an issue on [GitHub](https://github.com/your-username/bundir/issues)
- Include: OS, bun/node version, `.bundir.json` (redact secrets), and the exact command you ran
