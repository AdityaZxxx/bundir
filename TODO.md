# TODO - bundir

## Current Status

- [x] Core file organization by extension
- [x] Config system (global + local + CLI)
- [x] Conflict resolution (skip/overwrite/rename)
- [x] Recursive mode
- [x] Undo functionality
- [x] Dry-run mode
- [x] Comprehensive tests
- [x] Basic README
- [x] Prettier setup

## High Priority

### Documentation

- [ ] Add LICENSE file (MIT)
- [ ] Add CONTRIBUTING.md
- [ ] Add GitHub badges to README (build status, version, license)
- [ ] Add examples section to README with screenshots
- [ ] Create troubleshooting guide

### Project Setup

- [ ] Add build script for publishing to npm
- [ ] Set up GitHub Actions CI/CD pipeline
- [ ] Configure automated releases
- [ ] Add npx install instructions

### Testing

- [ ] Add integration tests for real-world scenarios
- [ ] Add performance benchmarks
- [ ] Test with edge cases (empty directories, permission errors)
- [ ] Add tests for configuration validation

## Medium Priority

### Features

- [ ] Preset profiles (dev, downloads, desktop cleanup, media)
- [ ] Interactive mode (confirm before moves)
- [ ] Watch mode (auto-organize new files)
- [ ] Operation history with timestamps
- [ ] Filter rules (file size, date patterns)
- [ ] CLI progress bar for large operations
- [ ] Better logging (log rotation, levels, export to file)
- [ ] Configuration validation with helpful error messages
- [ ] Auto-detect file types by content (not just extension)
- [ ] Support for custom file matching (regex patterns)

### User Experience

- [ ] Color-coded output (success, warning, error)
- [ ] Confirm prompts before destructive operations
- [ ] Summary email/notification after organization
- [ ] Support for multiple target directories
- [ ] Exclude/include patterns (glob support)

## Low Priority

### Infrastructure

- [ ] Docker container for testing
- [ ] Homebrew formula for macOS
- [ ] AUR package for Arch Linux
- [ ] Scoop manifest for Windows
- [ ] Chocolatey package for Windows

### Advanced Features

- [ ] Plugin system for custom organizers
- [ ] Custom hooks (before/after move)
- [ ] File deduplication (by hash)
- [ ] Schedule organization (cron integration)
- [ ] Backup mode (copy instead of move)
- [ ] Undo multiple operations (history stack)
- [ ] Batch operations on multiple directories
- [ ] Remote directory support (SFTP, S3)
- [ ] Parallel file operations for performance

## Bugs & Issues

- [ ] None currently reported

## Code Improvements

- [ ] Add JSDoc comments to all public functions
- [ ] Improve error messages with context
- [ ] Add TypeScript strict mode
- [ ] Refactor to use dependency injection for better testability
- [ ] Extract file system operations to separate module
- [ ] Add more integration tests

## Learning & Documentation

- [ ] Add architecture diagram to README
- [ ] Create video tutorial/demo
- [ ] Write blog post about building the tool
- [ ] Add code of conduct
- [ ] Add security policy

## Polish

- [ ] Custom error handling classes
- [ ] Better CLI help text
- [ ] Add examples in --help output
- [ ] Optimize for large file sets (10,000+ files)
- [ ] Memory usage optimization
- [ ] Add version check notification

## Release Planning

- [ ] v1.0.0 - Stable release with all core features
- [ ] v1.1.0 - Add preset profiles
- [ ] v1.2.0 - Add watch mode
- [ ] v2.0.0 - Plugin system & advanced filters
