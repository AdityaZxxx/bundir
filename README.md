# bundir - Directory Organizer

[![CI](https://github.com/AdityaZxxx/bundir/actions/workflows/ci.yml/badge.svg)](https://github.com/AdityaZxxx/bundir/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/bundir)](https://www.npmjs.com/package/bundir)
[![License](https://img.shields.io/npm/l/bundir)](LICENSE)
[![Bun](https://img.shields.io/badge/Bun-1.2+-gray?logo=bun)](https://bun.sh)

A simple yet powerful CLI tool to organize files in a directory based on their type, helping you keep your folders tidy.

---

## Features

- **Customizable Organization**: Define your own categories and rules in a `.bundir.json` file
- **Recursive Mode**: Clean up not just one directory, but all of its subdirectories
- **Conflict Resolution**: Choose how to handle files with the same name: `skip`, `overwrite`, or `rename`
- **Undo Last Operation**: Safely revert the last organization with the `bundir undo` command
- **Dry Run Mode**: See what changes will be made without actually moving any files
- **Flexible Configuration**: Use a global `~/.bundir.json` for default settings and a local `.bundir.json` for project-specific rules

## Installation

### From Source

1. Clone this repository.
2. Install dependencies using Bun:
   ```bash
   bun install
   ```
3. Build the project:
   ```bash
   bun run build
   ```
4. Link globally for easy access:
   ```bash
   bun link
   ```

### From npm

```bash
npm install -g bundir
```

## Usage

The tool provides three main commands: `organize` (default), `init`, and `undo`.

### `organize` (Default Command)

Organizes a directory based on the configuration.

```bash
# Organize the current directory
bundir

# Organize a specific directory
bundir ~/Downloads
```

**Options:**

| Flag                           | Alias | Description                                          |
| :----------------------------- | :---: | :--------------------------------------------------- |
| `--recursive`                  | `-r`  | Organize files in subdirectories recursively.        |
| `--conflict-resolution <mode>` |       | Set conflict mode: `skip`, `overwrite`, or `rename`. |
| `--dry-run`                    |       | Simulate organization without moving files.          |
| `--verbose`                    |       | Enable detailed logging.                             |
| `--ignore-hidden`              |       | Ignore hidden files (starting with a dot).           |
| `--default-category <name>`    |       | Set the folder name for uncategorized files.         |

### `init`

Creates a default `.bundir.json` file in the current directory to get you started.

```bash
bundir init
```

### `undo`

Reverts the most recent `organize` operation. This command reads the `.bundir-undo.log` file to move files back to their original locations.

```bash
bundir undo
```

## Examples

### Clean up your Downloads folder

```bash
# Preview changes first
bundir ~/Downloads --dry-run --verbose

# Then organize for real
bundir ~/Downloads --recursive
```

### Organize a project directory

```bash
# Sort source files, docs, and assets
bundir /path/to/project --default-category misc
```

### Use custom conflict resolution

```bash
# Rename duplicates instead of skipping
bundir ~/Desktop --conflict-resolution rename
```

### Ignore hidden files (dotfiles)

```bash
bundir ~/Documents --ignore-hidden false
```

### Undo a mistake

```bash
bundir ~/Downloads --recursive
# Oops, wrong directory
bundir undo
```

### Sample output

```
Starting directory organization in /home/user/Downloads...
[MOVE] photo.png → media/images
[MOVE] report.pdf → documents
[MOVE] script.py → code/scripts

Organization Complete!
-------------------------
Processed:      12 files
Moved:          9 files
Dirs created:   5
Conflicts:      0 skipped, 0 overwritten, 0 renamed
Errors:         0
Time taken:     0.02s
-------------------------
```

---

## Configuration

Create a `.bundir.json` file in your project directory or home directory (`~/`) to customize the behavior.

The `bundir init` command will create a new `.bundir.json` file.

Here is an example configuration:

```json
{
  "options": {
    "dryRun": false,
    "verbose": true,
    "defaultCategory": "others",
    "ignoreHidden": true,
    "conflictResolution": "rename",
    "recursive": false
  },
  "categories": {
    "images": {
      "extensions": [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"],
      "targetDir": "media/images"
    },
    "videos": {
      "extensions": [".mp4", ".mkv", ".mov"],
      "targetDir": "media/videos"
    },
    "documents": {
      "extensions": [".pdf", ".docx", ".txt", ".md"],
      "targetDir": "documents"
    },
    "archives": {
      "extensions": [".zip", ".rar", ".tar.gz"],
      "targetDir": "archives"
    }
  }
}
```

---

## Development

```bash
# Run in development
bun start

# Run tests
bun test

# Lint
bun run lint

# Format code
bun run format

# Build for production
bun run build
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
