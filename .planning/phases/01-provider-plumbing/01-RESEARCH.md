# Phase 1: Provider Plumbing - Research

**Researched:** 2026-02-12
**Domain:** Electron main process service architecture, filesystem abstraction patterns
**Confidence:** HIGH

## Summary

Phase 1 requires threading `FileSystemProvider` through three critical parsing services (`SessionParser`, `SubagentResolver`, `SubagentDetailBuilder`) to enable SSH session loading. The current architecture already has the provider abstraction and SSH implementation in place, but the parsing stack hardcodes calls to `parseJsonlFile()` which defaults to local filesystem access. The fix is straightforward: pass `FileSystemProvider` through service constructors and method signatures to reach `parseJsonlFile()`, which already accepts an optional provider parameter.

The existing mode-switching architecture in `src/main/index.ts` (lines 96-136) provides the blueprint: when switching local↔SSH, services are recreated with the correct provider. However, Phase 1 only needs to ensure the provider threads through correctly; Phase 2 will handle multi-context infrastructure.

**Primary recommendation:** Add `FileSystemProvider` parameters to service constructors and method signatures following the existing `ProjectScanner` pattern, ensuring all `parseJsonlFile()` calls receive the correct provider instance.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ssh2 | (current) | SFTP implementation | Industry standard Node.js SSH/SFTP client, already used in `SshFileSystemProvider` |
| Node.js stream | Built-in | Streaming JSONL parsing | Native API, optimal for large file processing |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| readline | Built-in | Line-by-line JSONL processing | Already used in `parseJsonlFile()` for streaming |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Constructor injection | Service locator pattern | Constructor injection is explicit and testable; avoid service locator for this scope |
| Optional parameters | Required parameters | Keep optional for backward compatibility during refactor, but document the default |

**Installation:**
No new dependencies required. Existing code has all necessary abstractions.

## Architecture Patterns

### Recommended Project Structure
Current structure is correct:
```
src/main/
├── services/
│   ├── infrastructure/      # FileSystemProvider, LocalFileSystemProvider, SshFileSystemProvider
│   ├── parsing/             # SessionParser (NEEDS provider threading)
│   ├── discovery/           # SubagentResolver (NEEDS provider threading)
│   └── analysis/            # SubagentDetailBuilder (NEEDS provider threading)
├── utils/
│   └── jsonl.ts            # parseJsonlFile() already accepts provider parameter
└── index.ts                # Service instantiation, mode-switching handler
```

### Pattern 1: Provider Injection via Constructor
**What:** Pass `FileSystemProvider` to service constructors, store as instance field
**When to use:** For services that make multiple filesystem calls (SessionParser, SubagentResolver)
**Example:**
```typescript
// Source: Existing pattern in ProjectScanner (lines 78-89)
export class SessionParser {
  private projectScanner: ProjectScanner;
  private fsProvider: FileSystemProvider; // ADD THIS

  constructor(projectScanner: ProjectScanner, fsProvider?: FileSystemProvider) {
    this.projectScanner = projectScanner;
    // Default to local provider if not specified
    this.fsProvider = fsProvider ?? new LocalFileSystemProvider();
  }

  async parseSessionFile(filePath: string): Promise<ParsedSession> {
    const messages = await parseJsonlFile(filePath, this.fsProvider); // PASS THROUGH
    return this.processMessages(messages);
  }
}
```

### Pattern 2: Provider Access via Delegation
**What:** Services that already have a `ProjectScanner` instance can get provider from it
**When to use:** When refactoring would be minimal and avoids parameter bloat
**Example:**
```typescript
// ProjectScanner already stores fsProvider (line 71)
export class SessionParser {
  private projectScanner: ProjectScanner;

  // Access provider through projectScanner
  async parseSessionFile(filePath: string): Promise<ParsedSession> {
    const provider = this.projectScanner.getFileSystemProvider();
    const messages = await parseJsonlFile(filePath, provider);
    return this.processMessages(messages);
  }
}
```

**Note:** Pattern 2 requires adding a `getFileSystemProvider()` getter to `ProjectScanner`, but reduces constructor parameter changes and keeps provider access centralized.

### Pattern 3: SubagentDetailBuilder Function Signature
**What:** `buildSubagentDetail()` is a standalone function, not a class. Add provider parameter.
**When to use:** For functional builders called directly by IPC handlers
**Example:**
```typescript
// Current signature (line 39-46)
export async function buildSubagentDetail(
  projectId: string,
  _sessionId: string,
  subagentId: string,
  sessionParser: SessionParser,
  subagentResolver: SubagentResolver,
  buildChunksFn: (messages: ParsedMessage[], subagents: Process[]) => EnhancedChunk[]
): Promise<SubagentDetail | null>

// After Phase 1: add fsProvider parameter
export async function buildSubagentDetail(
  projectId: string,
  _sessionId: string,
  subagentId: string,
  sessionParser: SessionParser,
  subagentResolver: SubagentResolver,
  buildChunksFn: (messages: ParsedMessage[], subagents: Process[]) => EnhancedChunk[],
  fsProvider: FileSystemProvider // ADD THIS
): Promise<SubagentDetail | null>
```

### Anti-Patterns to Avoid
- **Importing `fs/promises` directly in services:** SubagentDetailBuilder (lines 48-62) bypasses provider abstraction by using direct `fs.access()`. Replace with `fsProvider.exists()`.
- **Global default provider:** `jsonl.ts` line 36 creates `defaultProvider = new LocalFileSystemProvider()`. This is correct as a fallback, but services must explicitly pass their provider to avoid silent local fallback in SSH mode.
- **Provider singleton:** Do not create a global provider instance. Each service context needs its own provider instance (critical for Phase 2).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SFTP read streams | Custom buffer management, chunk assembly | ssh2's `createReadStream()` piped to PassThrough | ssh2 handles SSH protocol details, reconnection, buffering; PassThrough ensures Node.js stream compatibility (see `SshFileSystemProvider.ts` lines 98-112) |
| Filesystem abstraction testing | Mock entire `fs` module | Inject `FileSystemProvider` interface | Interface injection enables clean testing without rewiring Node.js internals |
| Service lifecycle during mode switch | Manual cleanup tracking | Follow existing `handleModeSwitch()` pattern | Already proven pattern in `index.ts` lines 96-136: stop watchers, clear cache, recreate services |

**Key insight:** The provider abstraction already exists and works correctly (`FileSystemProvider`, `LocalFileSystemProvider`, `SshFileSystemProvider`). The problem is not the abstraction itself, but that some services bypass it. Don't rebuild the abstraction; just use it consistently.

## Common Pitfalls

### Pitfall 1: Silent Fallback to Local Provider
**What goes wrong:** `parseJsonlFile()` defaults to local provider when no provider is passed, causing SSH sessions to silently read local files (or fail with "file not found").
**Why it happens:** Optional parameter with default value in `jsonl.ts` line 52: `fsProvider: FileSystemProvider = defaultProvider`
**How to avoid:**
- Always explicitly pass provider to `parseJsonlFile()` in all service methods
- Add logging in development mode when default provider is used (helps catch missed call sites)
**Warning signs:**
- SSH mode shows "No conversation history" for sessions that definitely have messages
- Console logs from `jsonl.ts` show ENOENT errors for paths that should exist remotely

### Pitfall 2: Hardcoded Path Construction
**What goes wrong:** `SubagentDetailBuilder` constructs paths using `os.homedir()` + hardcoded `.claude/projects/` (lines 53-54), which always resolves to local filesystem even in SSH mode.
**Why it happens:** Function was written before SSH support, assumes single filesystem
**How to avoid:**
- Use `ProjectScanner` path utilities (`buildSessionPath`, `buildSubagentsPath`) which already handle encoding
- OR: Accept absolute file paths from callers who know the correct base directory
**Warning signs:**
- Subagent drill-down works locally but fails with "file not found" in SSH mode
- Path logging shows local home directory when SSH mode is active

### Pitfall 3: Forgetting Nested Subagent Resolution
**What goes wrong:** `SubagentDetailBuilder` calls `subagentResolver.resolveSubagents()` (line 68) which internally calls `parseJsonlFile()` multiple times. If `SubagentResolver.parseSubagentFile()` doesn't have the provider, nested subagents fail to load.
**Why it happens:** Chain of calls: `buildSubagentDetail()` → `SubagentResolver.resolveSubagents()` → `SubagentResolver.parseSubagentFile()` → `parseJsonlFile()`. Provider must thread through entire chain.
**How to avoid:**
- Test subagent drill-down specifically in SSH mode (not just session loading)
- Ensure `SubagentResolver` stores provider as instance field and uses it in `parseSubagentFile()`
**Warning signs:**
- Main session messages load correctly but subagent cards show "Failed to load" or empty state
- Subagent drill-down modal opens but shows no content

### Pitfall 4: Test Mocking Inconsistency
**What goes wrong:** Tests mock `ProjectScanner` but don't provide a `getFileSystemProvider()` method, causing tests to fail after refactoring.
**Why it happens:** Test mocks in `SessionParser.test.ts` (lines 24-33) are partial mocks missing new methods
**How to avoid:**
- Update test mocks to include `getFileSystemProvider()` returning a `LocalFileSystemProvider` instance
- Consider creating a `MockFileSystemProvider` test helper for consistent mocking
**Warning signs:**
- Tests pass before refactor, fail with "getFileSystemProvider is not a function" after
- Tests fail even though manual testing works

## Code Examples

Verified patterns from existing codebase:

### Example 1: Service Initialization with Provider (from main/index.ts)
```typescript
// Source: src/main/index.ts lines 111-113
const provider = sshConnectionManager.getProvider();
const projectsDir = mode === 'ssh'
  ? (sshConnectionManager.getRemoteProjectsPath() ?? undefined)
  : undefined;

projectScanner = new ProjectScanner(projectsDir, undefined, provider);
sessionParser = new SessionParser(projectScanner);
subagentResolver = new SubagentResolver(projectScanner);
```

### Example 2: Existing Provider Pattern in ProjectScanner
```typescript
// Source: src/main/services/discovery/ProjectScanner.ts lines 78-89
constructor(projectsDir?: string, todosDir?: string, fsProvider?: FileSystemProvider) {
  this.projectsDir = projectsDir ?? getProjectsBasePath();
  this.todosDir = todosDir ?? getTodosBasePath();
  this.fsProvider = fsProvider ?? new LocalFileSystemProvider();

  // Initialize delegated services WITH PROVIDER
  this.sessionContentFilter = SessionContentFilter;
  this.worktreeGrouper = new WorktreeGrouper(this.projectsDir, this.fsProvider);
  this.subagentLocator = new SubagentLocator(this.projectsDir, this.fsProvider);
  this.sessionSearcher = new SessionSearcher(this.projectsDir, this.fsProvider);
  this.projectPathResolver = new ProjectPathResolver(this.projectsDir, this.fsProvider);
}
```

### Example 3: parseJsonlFile with Provider Parameter
```typescript
// Source: src/main/utils/jsonl.ts lines 50-64
export async function parseJsonlFile(
  filePath: string,
  fsProvider: FileSystemProvider = defaultProvider // OPTIONAL with default
): Promise<ParsedMessage[]> {
  const messages: ParsedMessage[] = [];

  if (!(await fsProvider.exists(filePath))) {
    return messages;
  }

  const fileStream = fsProvider.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const parsed = parseJsonlLine(line);
      if (parsed) {
        messages.push(parsed);
      }
    } catch (error) {
      logger.error(`Error parsing line in ${filePath}:`, error);
    }
  }

  return messages;
}
```

### Example 4: Mode Switch Handler (Service Recreation Pattern)
```typescript
// Source: src/main/index.ts lines 96-136
const handleModeSwitch = async (mode: 'local' | 'ssh'): Promise<void> => {
  logger.info(`Switching to ${mode} mode`);

  // 1. Stop watchers
  fileWatcher.stop();

  // 2. Clear cache
  dataCache.clear();

  // 3. Get provider from connection manager
  const provider = sshConnectionManager.getProvider();
  const projectsDir = mode === 'ssh'
    ? (sshConnectionManager.getRemoteProjectsPath() ?? undefined)
    : undefined;

  // 4. Recreate services with new provider
  projectScanner = new ProjectScanner(projectsDir, undefined, provider);
  sessionParser = new SessionParser(projectScanner);
  subagentResolver = new SubagentResolver(projectScanner);

  // 5. Re-initialize IPC handlers with new instances
  reinitializeServiceHandlers(
    projectScanner,
    sessionParser,
    subagentResolver,
    chunkBuilder,
    dataCache
  );

  // 6. Update file watcher provider
  fileWatcher.setFileSystemProvider(provider);

  // 7. Restart watcher
  fileWatcher.start();

  // 8. Notify renderer
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(SSH_STATUS, sshConnectionManager.getStatus());
  }

  logger.info(`Mode switch to ${mode} complete`);
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct `fs` imports throughout services | `FileSystemProvider` abstraction | Added with SSH support (recent) | Enables remote file access, but not all services use it yet |
| Single global service instances | Mode-switching service recreation | Added with SSH support (recent) | Enables local↔SSH switching, but destroys local state (Phase 2 will fix) |
| Synchronous file reads | Streaming with readline | Original architecture | Efficient for large JSONL files, correct pattern |

**Deprecated/outdated:**
- Direct `fs/promises` imports in services: `SubagentDetailBuilder` still uses this (lines 48-50). Should be replaced with provider calls.

## Open Questions

1. **Should ProjectScanner expose `getFileSystemProvider()` or should services store their own reference?**
   - What we know: ProjectScanner already stores `fsProvider` (line 71). SessionParser and SubagentResolver both receive ProjectScanner in constructor.
   - What's unclear: Whether delegating through ProjectScanner is cleaner than duplicating the reference in each service.
   - Recommendation: Add `getFileSystemProvider()` getter to ProjectScanner. Reduces constructor changes, centralizes provider access, matches existing delegation pattern (line 84 uses SessionContentFilter, lines 85-88 pass provider to delegated services).

2. **Should SubagentDetailBuilder become a class or stay a function?**
   - What we know: It's currently a standalone function (line 39). IPC handler calls it directly. It needs access to `fsProvider`, `projectsDir`, and multiple service instances.
   - What's unclear: Whether the complexity warrants a class or if adding parameters is sufficient.
   - Recommendation: Keep as function for Phase 1, add `fsProvider` parameter. Phase 2 (ServiceContextRegistry) may benefit from a builder class, but don't pre-optimize.

3. **Do tests need a dedicated MockFileSystemProvider or just mock existing providers?**
   - What we know: Tests currently mock ProjectScanner (test/main/services/parsing/SessionParser.test.ts lines 24-33). LocalFileSystemProvider is a real implementation.
   - What's unclear: Whether tests should use real LocalFileSystemProvider with temp files, or mock it.
   - Recommendation: Use real LocalFileSystemProvider for integration-style tests (current pattern). Mock only for unit tests that don't need real file I/O. Create `MockFileSystemProvider` helper if tests start duplicating mock setup.

## Sources

### Primary (HIGH confidence)
- Existing codebase files:
  - `src/main/services/infrastructure/FileSystemProvider.ts` - Interface definition
  - `src/main/services/infrastructure/SshFileSystemProvider.ts` - SSH implementation
  - `src/main/services/discovery/ProjectScanner.ts` - Provider injection pattern
  - `src/main/utils/jsonl.ts` - parseJsonlFile provider parameter
  - `src/main/index.ts` - Mode-switching handler
  - `.planning/ROADMAP.md` - Phase 1 requirements and success criteria
  - `.planning/REQUIREMENTS.md` - PROV-01, PROV-02 detailed requirements

### Secondary (MEDIUM confidence)
- None required; all information sourced from codebase inspection

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No external libraries needed, existing abstractions are complete
- Architecture: HIGH - Patterns already proven in ProjectScanner and delegated services
- Pitfalls: HIGH - All identified from actual code inspection and known failure modes

**Research date:** 2026-02-12
**Valid until:** 30 days (stable architecture, no fast-moving dependencies)
