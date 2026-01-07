# bundir - Directory Organizer

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

Then use directly:

```bash
bundir organize
```

## Usage

The tool provides three main commands: `organize` (default), `init`, and `undo`.

### `organize` (Default Command)

Organizes a directory based on the configuration.

```bash
# Organize the current directory
bundir

# Organize a specific directory
bundir /path/to/your/directory
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
    "conflictResolution": "rename", // Can be "skip", "overwrite", or "rename"
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

## Development

- **Run the tool in development:**

  ```bash
  bun run src/index.ts
  ```

- **Run tests:**

  ```bash
  bun test
  ```
