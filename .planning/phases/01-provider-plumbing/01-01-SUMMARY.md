---
phase: 01-provider-plumbing
plan: 01
subsystem: session-parsing
tags: [ssh-support, provider-threading, refactoring]
dependency-graph:
  requires: [FileSystemProvider, ProjectScanner]
  provides: [provider-aware-parsing, provider-aware-subagent-detail]
  affects: [SessionParser, SubagentResolver, SubagentDetailBuilder, ChunkBuilder, IPC-handlers]
tech-stack:
  added: []
  patterns: [provider-injection, dependency-threading]
key-files:
  created: []
  modified:
    - src/main/services/discovery/ProjectScanner.ts
    - src/main/services/parsing/SessionParser.ts
    - src/main/services/discovery/SubagentResolver.ts
    - src/main/services/analysis/SubagentDetailBuilder.ts
    - src/main/services/analysis/ChunkBuilder.ts
    - src/main/ipc/subagents.ts
    - src/main/ipc/handlers.ts
    - test/main/services/parsing/SessionParser.test.ts
decisions:
  - "Added getFileSystemProvider() getter to ProjectScanner for consistent provider access across services"
  - "Threaded provider through all three parseJsonlFile() call sites instead of relying on optional parameter fallback"
  - "Refactored SubagentDetailBuilder to accept fsProvider and projectsDir as explicit parameters instead of using dynamic imports"
  - "Propagated ProjectScanner to IPC subagent handler to obtain provider and projectsDir at runtime"
metrics:
  duration: 4
  completed: 2026-02-12T00:15:16Z
---

# Phase 01 Plan 01: Thread FileSystemProvider Through Session Parsing Stack Summary

**FileSystemProvider now flows consistently from ProjectScanner through SessionParser, SubagentResolver, and SubagentDetailBuilder, enabling SSH sessions to load conversation history over SFTP.**

## What Was Built

Threaded the `FileSystemProvider` abstraction through the entire session parsing stack, eliminating silent fallbacks to `LocalFileSystemProvider` that caused SSH sessions to show "No conversation history."

### Task 1: Provider Threading Through SessionParser and SubagentResolver

Added `getFileSystemProvider()` getter to `ProjectScanner` and updated three `parseJsonlFile()` call sites to pass the provider:

1. **ProjectScanner.getFileSystemProvider()** - New getter exposes the provider instance
2. **SessionParser.parseSessionFile()** - Now passes `this.projectScanner.getFileSystemProvider()` to `parseJsonlFile()`
3. **SessionParser.parseSubagentFile()** - Now passes `this.projectScanner.getFileSystemProvider()` to `parseJsonlFile()`
4. **SubagentResolver.parseSubagentFile()** - Now passes `this.projectScanner.getFileSystemProvider()` to `parseJsonlFile()`

Updated `SessionParser.test.ts` mock to include `getFileSystemProvider` method returning `LocalFileSystemProvider` instance.

**Commit:** `a3f5daf` - feat(01-01): thread FileSystemProvider through SessionParser and SubagentResolver

### Task 2: Refactor SubagentDetailBuilder to Use Provider

Removed hardcoded `fs/promises`, `os.homedir()`, and `fs.access()` calls from `SubagentDetailBuilder`, replacing them with provider-based operations:

1. **SubagentDetailBuilder.buildSubagentDetail()** - Added `fsProvider` and `projectsDir` parameters, removed dynamic imports of `fs/promises`, `os`, replaced `os.homedir()` with `projectsDir`, replaced `fs.access()` with `fsProvider.exists()`
2. **ChunkBuilder.buildSubagentDetail()** - Added `fsProvider` and `projectsDir` parameters, passed through to `buildSubagentDetailFn()`
3. **IPC subagents handler** - Updated `initializeSubagentHandlers()` to accept `ProjectScanner`, obtains `fsProvider` and `projectsDir` from scanner in `handleGetSubagentDetail()`
4. **IPC handlers.ts** - Updated both `initializeIpcHandlers()` and `reinitializeServiceHandlers()` to pass `scanner` to `initializeSubagentHandlers()`

**Commit:** `c12b329` - feat(01-01): refactor SubagentDetailBuilder to use FileSystemProvider

## Technical Implementation

### Provider Flow Architecture

```
index.ts (creates ProjectScanner with SSH provider)
  └─> ProjectScanner.fsProvider (stored privately)
      └─> ProjectScanner.getFileSystemProvider() (public getter)
          ├─> SessionParser.parseSessionFile() → parseJsonlFile(path, provider)
          ├─> SessionParser.parseSubagentFile() → parseJsonlFile(path, provider)
          ├─> SubagentResolver.parseSubagentFile() → parseJsonlFile(path, provider)
          └─> IPC subagents handler → ChunkBuilder → SubagentDetailBuilder
              ├─> fsProvider.exists() (file check)
              └─> projectsDir (path construction)
```

### Key Pattern Changes

**Before (Task 1):**
```typescript
const messages = await parseJsonlFile(filePath);
// Silently falls back to LocalFileSystemProvider
```

**After (Task 1):**
```typescript
const messages = await parseJsonlFile(filePath, this.projectScanner.getFileSystemProvider());
// Explicitly uses the provider from ProjectScanner
```

**Before (Task 2):**
```typescript
const fs = await import('fs/promises');
const os = await import('os');
const claudeDir = path.join(os.homedir(), '.claude', 'projects');
await fs.access(subagentPath);
// Always uses local filesystem, always assumes ~/.claude/projects
```

**After (Task 2):**
```typescript
const subagentPath = path.join(projectsDir, projectId, 'subagents', `agent-${subagentId}.jsonl`);
if (!(await fsProvider.exists(subagentPath))) { /* ... */ }
// Uses injected provider and projectsDir, works for both local and SSH
```

## Deviations from Plan

None - plan executed exactly as written.

## Testing & Verification

- **Type safety:** `pnpm typecheck` passes with zero errors
- **Test suite:** All 494 tests pass (31 test files)
- **No local filesystem leaks:** Verified zero matches for `fs/promises`, `os.homedir`, and bare `parseJsonlFile(filePath)` calls in SessionParser, SubagentResolver, and SubagentDetailBuilder
- **Provider flow confirmed:** All three services now receive FileSystemProvider from ProjectScanner's getter

## Impact

### Immediate
- SSH sessions will now load conversation history correctly (once SSH provider is fully wired in index.ts)
- Subagent drill-down will work over SFTP
- No more silent fallbacks to local filesystem in parsing stack

### Downstream
- Phase 1 Plans 02-04 can now implement provider-based operations for todos, watchers, and search
- All file operations in the parsing/analysis layer now use the provider abstraction consistently

## Self-Check: PASSED

### Created Files
No new files created (all modifications to existing files).

### Modified Files Verified
- [x] src/main/services/discovery/ProjectScanner.ts - Contains `getFileSystemProvider()` getter
- [x] src/main/services/parsing/SessionParser.ts - Both `parseJsonlFile()` calls pass provider
- [x] src/main/services/discovery/SubagentResolver.ts - `parseJsonlFile()` call passes provider
- [x] src/main/services/analysis/SubagentDetailBuilder.ts - No `fs/promises` or `os.homedir`, uses `fsProvider.exists()`
- [x] src/main/services/analysis/ChunkBuilder.ts - Passes `fsProvider` and `projectsDir` parameters
- [x] src/main/ipc/subagents.ts - Obtains provider from `ProjectScanner`
- [x] src/main/ipc/handlers.ts - Passes `scanner` to `initializeSubagentHandlers()`
- [x] test/main/services/parsing/SessionParser.test.ts - Mock includes `getFileSystemProvider()`

### Commits Verified
- [x] a3f5daf - Task 1 commit exists
- [x] c12b329 - Task 2 commit exists

All files exist, all commits present. Self-check passed.
