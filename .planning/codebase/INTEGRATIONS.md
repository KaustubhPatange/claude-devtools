# External Integrations

**Analysis Date:** 2026-02-12

## APIs & External Services

**SSH/SFTP:**
- ssh2 - Direct SSH client implementation for remote session access
  - SDK/Client: `ssh2` package (Node.js native)
  - Auth: SSH agent, password, or private key authentication
  - Implementation: `src/main/services/infrastructure/SshConnectionManager.ts`
  - Config parsing: `src/main/services/infrastructure/SshConfigParser.ts` (reads `~/.ssh/config`)
  - File system: `src/main/services/infrastructure/SshFileSystemProvider.ts` (SFTP-based)
  - Purpose: Read Claude Code session files from remote machines

**GitHub Releases:**
- electron-updater - Auto-update via GitHub release assets
  - SDK/Client: `electron-updater` package
  - Configuration: `electron-builder.yml` publish section
  - Implementation: `src/main/services/infrastructure/UpdaterService.ts`
  - Update flow: Check → Download → Install (user-confirmed)
  - Purpose: Application auto-updates

## Data Storage

**Databases:**
- None - File-based storage only

**File Storage:**
- Local filesystem only
- Session data: `~/.claude/projects/{encoded-path}/*.jsonl` (read-only)
- App config: `~/.claude/claude-devtools-config.json` (read-write)
- Notifications: `~/.claude/claude-devtools-notifications.json` (read-write)
- Remote access: SFTP via ssh2 (optional)

**Caching:**
- In-memory LRU cache - `src/main/services/infrastructure/DataCache.ts`
  - Max entries: 50 sessions
  - TTL: 10 minutes
  - Auto-cleanup: Every 5 minutes
  - Disable flag: `CLAUDE_CONTEXT_DISABLE_CACHE=1`

## Authentication & Identity

**Auth Provider:**
- SSH authentication (remote access only)
  - Methods: SSH agent, password, private key
  - Agent discovery: `SSH_AUTH_SOCK` env var, launchctl (macOS), known socket paths
  - 1Password SSH agent: Supported via `~/Library/Group Containers/2BUA8C4S2C.com.1password/agent.sock`
  - Default keys: `~/.ssh/id_ed25519`, `~/.ssh/id_rsa`, `~/.ssh/id_ecdsa`
  - Config: `~/.ssh/config` parsing for host aliases, identity files

**Git Identity:**
- Git identity resolution - `src/main/services/parsing/GitIdentityResolver.ts`
  - Reads `.git/config` for user.name/user.email
  - Purpose: Display commit author information in UI

## Monitoring & Observability

**Error Tracking:**
- None - Local logging only via `@shared/utils/logger.ts`

**Logs:**
- Console output (main process)
- Electron DevTools console (renderer process)
- Log prefix format: `[Domain:Service]` (e.g., `[Infrastructure:SshConnectionManager]`)

## CI/CD & Deployment

**Hosting:**
- GitHub - Source repository and release hosting

**CI Pipeline:**
- GitHub Actions
  - Workflow: `.github/workflows/ci.yml` - Lint, typecheck, test, build
  - Workflow: `.github/workflows/release.yml` - Build and publish releases

**Build Output:**
- Local: `dist-electron/` (compiled code), `out/` (packaged app)
- Distribution: `release/` directory
  - macOS: DMG, ZIP
  - Windows: NSIS installer
- ASAR: Enabled (app code packaged into single archive)

## Environment Configuration

**Required env vars:**
- None for local mode

**Optional env vars:**
- `CLAUDE_CONTEXT_DISABLE_CACHE=1` - Disable in-memory cache
- `NODE_ENV=development` - Development mode
- `APPLE_TEAM_ID` - macOS code signing team ID (build-time only)
- `SSH_AUTH_SOCK` - SSH agent socket path (runtime, optional)

**Secrets location:**
- SSH keys: `~/.ssh/` directory
- SSH agent: External (OS keychain, 1Password)
- App config: `~/.claude/claude-devtools-config.json` (user preferences, no secrets)

## Webhooks & Callbacks

**Incoming:**
- None - Desktop application with no server component

**Outgoing:**
- None - No webhook emissions

## IPC Communication

**Electron IPC:**
- Pattern: Main ↔ Preload ↔ Renderer communication
- Bridge: `contextBridge` in `src/preload/index.ts` exposes `window.electronAPI`
- Channels: Defined in `src/preload/constants/ipcChannels.ts`
- Domains:
  - Sessions: Project/session listing, search, detail views
  - Repository: Git worktree grouping
  - Validation: Path and mention validation
  - CLAUDE.md: Configuration file reading
  - Config: App settings management
  - Notifications: Error notifications and triggers
  - Utilities: Shell operations, file watching
  - SSH: Remote connection management
  - Updater: Update lifecycle events

**Real-time Updates:**
- File watching: `chokidar`-based file system monitoring
  - Debounce: 100ms
  - Events: `file-change`, `todo-change`
  - Implementation: `src/main/services/infrastructure/FileWatcher.ts`
  - Supports both local and SSH file systems

## External File Access

**Session Files:**
- Location: `~/.claude/projects/{encoded-path}/*.jsonl`
- Format: JSONL (JSON Lines) with Claude Code conversation data
- Access: Read-only
- Parser: `src/main/services/parsing/SessionParser.ts`

**Configuration Files:**
- `~/.claude/CLAUDE.md` - Global Claude Code configuration
- `{project-root}/CLAUDE.md` - Project-specific configuration
- `{directory}/CLAUDE.md` - Directory-specific configuration
- Reader: `src/main/services/parsing/ClaudeMdReader.ts`

**Git Worktrees:**
- Reads `.git/config` for worktree detection
- Grouper: `src/main/services/discovery/WorktreeGrouper.ts`

---

*Integration audit: 2026-02-12*
