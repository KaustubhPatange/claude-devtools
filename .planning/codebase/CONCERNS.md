# Codebase Concerns

**Analysis Date:** 2026-02-12

## Tech Debt

**Large, complex files needing refactoring:**
- Issue: Several files exceed 700-1100 lines with complex business logic
- Files:
  - `src/renderer/utils/contextTracker.ts` (1099 lines)
  - `src/main/services/discovery/ProjectScanner.ts` (827 lines)
  - `src/main/services/infrastructure/FileWatcher.ts` (798 lines)
  - `src/renderer/components/chat/ChatHistory.tsx` (745 lines)
  - `src/renderer/store/slices/tabSlice.ts` (740 lines)
  - `src/main/services/infrastructure/ConfigManager.ts` (701 lines)
  - `src/renderer/utils/groupTransformer.ts` (700 lines)
  - `src/main/services/parsing/GitIdentityResolver.ts` (674 lines)
  - `src/renderer/store/slices/sessionDetailSlice.ts` (658 lines)
  - `src/main/services/infrastructure/NotificationManager.ts` (657 lines)
  - `src/renderer/utils/claudeMdTracker.ts` (656 lines)
  - `src/main/ipc/config.ts` (628 lines)
- Impact: Difficult to maintain, test, and debug; high cognitive load for changes
- Fix approach: Extract into smaller modules with single responsibilities; split contextTracker into separate concerns (injection detection, stats computation, phase tracking); break ConfigManager into domain-specific config handlers; split ChatHistory view logic from virtualization/scroll management

**Type safety gaps with `as any` and `as unknown` casts:**
- Issue: Type assertions bypass TypeScript's type checking
- Files:
  - `src/main/services/infrastructure/SshConnectionManager.ts:171` - `sftp as any` for SSH provider
  - `src/main/services/infrastructure/SshFileSystemProvider.ts:44` - `data as unknown as string`
  - `src/main/services/infrastructure/NotificationManager.ts:170` - `JSON.parse(data) as unknown`
  - `src/main/services/discovery/ProjectScanner.ts:659` - `JSON.parse(content) as unknown`
  - `src/main/services/analysis/ToolResultExtractor.ts:140` - `content as unknown[]`
  - `src/main/services/analysis/SemanticStepExtractor.ts:169` - `msg.toolUseResult as unknown`
  - `src/main/utils/jsonl.ts:450` - `entry as unknown as Record<string, unknown>`
  - Test files: Extensive use in `test/main/services/infrastructure/FileWatcher.test.ts` for mocking
- Impact: Potential runtime type errors; bypasses compiler safety net
- Fix approach: Create proper type guards and validation functions; use Zod schemas for JSON parsing; properly type SSH2/SFTP library interfaces instead of `any`

**Empty catch blocks silently swallowing errors:**
- Issue: 213 try/catch occurrences across 62 files, many with minimal error handling
- Files: All IPC handlers, store slices, service files
- Impact: Silent failures make debugging difficult; errors may go unnoticed
- Fix approach: Add structured logging to all catch blocks; implement error telemetry; ensure all errors bubble up or are explicitly handled with user feedback

**SSH connection type safety issues:**
- Issue: SSH2 library types not properly integrated, forcing `any` casts
- Files: `src/main/services/infrastructure/SshConnectionManager.ts`, `src/main/services/infrastructure/SshFileSystemProvider.ts`
- Impact: Runtime errors in SSH operations won't be caught at compile time
- Fix approach: Create proper TypeScript interfaces for SSH2/SFTP types; use branded types or runtime validation

**Disabled ESLint rules indicate code smells:**
- Issue: 30+ eslint-disable comments suggest underlying design issues
- Files:
  - `src/renderer/components/chat/ChatHistory.tsx:417,425` - Direct DOM mutation for search highlighting
  - `src/renderer/components/chat/AIChatGroup.tsx:195` - Manual memoization instead of React Compiler
  - `src/renderer/hooks/useAutoScrollBottom.ts:144,178,204,247` - Complex effect dependencies
  - `src/renderer/components/sidebar/DateGroupedSessions.tsx:157` - TanStack Virtual API limitation
  - `src/renderer/utils/groupTransformer.ts:57` - Regex flagged as potentially unsafe
- Impact: Code may be fragile or have performance issues
- Fix approach: Refactor direct DOM mutations into proper React state management; simplify effect dependencies; document why ESLint rules must be disabled

## Known Bugs

**None explicitly documented in code:**
- Symptoms: No TODO/FIXME/HACK/BUG comments found in source
- Trigger: N/A
- Workaround: N/A

## Security Considerations

**IPC input validation present but could be stricter:**
- Risk: Malformed IPC inputs could cause crashes or unexpected behavior
- Files: `src/main/ipc/guards.ts`, all IPC handlers in `src/main/ipc/`
- Current mitigation: Validation guards with max length checks (128-512 chars), pattern validation, coercion for numeric inputs
- Recommendations:
  - Add rate limiting on IPC calls to prevent DOS
  - Validate file paths more strictly to prevent directory traversal
  - Add schema validation for complex config objects (use Zod)

**Content sanitization exists but not comprehensive:**
- Risk: User-provided content from JSONL files could contain malicious content
- Files: `src/shared/utils/contentSanitizer.ts` - sanitizes display content, removes control characters
- Current mitigation: Basic content sanitization with regex pattern removal
- Recommendations:
  - Add HTML escaping for any user content rendered in DOM
  - Validate markdown content for XSS vectors
  - Implement Content Security Policy headers

**File system access is broad:**
- Risk: App has access to entire user home directory via `~/.claude/`
- Files: `src/main/services/infrastructure/LocalFileSystemProvider.ts`, `src/main/services/infrastructure/SshFileSystemProvider.ts`
- Current mitigation: Access limited to specific Claude directories; path validation in IPC handlers
- Recommendations:
  - Add explicit allow-list of accessible directories
  - Log all file system operations for audit trail
  - Implement file size limits to prevent memory exhaustion

**SSH connection security:**
- Risk: SSH credentials and private keys handled in memory
- Files: `src/main/services/infrastructure/SshConnectionManager.ts`, `src/main/services/infrastructure/SshConfigParser.ts`
- Current mitigation: Supports SSH agent, private key files; no plain password storage
- Recommendations:
  - Ensure private keys are not logged
  - Add connection timeout and retry limits
  - Validate SSH host keys to prevent MITM attacks
  - Document that passwords should use SSH agent, not inline

**Regex injection prevention:**
- Risk: User-provided regex patterns in notification triggers could cause ReDoS
- Files: `src/main/utils/regexValidation.ts`, `src/main/services/error/TriggerMatcher.ts`
- Current mitigation: Regex validation with complexity limits, documented as preventing ReDoS
- Recommendations: Continue validating all user regex; consider timeout mechanism for regex execution

## Performance Bottlenecks

**Large JSONL file parsing on every load:**
- Problem: Session files can be large (10k+ lines), parsed synchronously line-by-line
- Files: `src/main/utils/jsonl.ts:50-80` - `parseJsonlFile()`, `src/main/services/parsing/SessionParser.ts`
- Cause: Streaming reads mitigate memory issues but CPU-bound parsing still blocks
- Improvement path:
  - Implement incremental parsing (read only viewport range initially)
  - Add progress indicators for large files
  - Cache parsed results more aggressively (current: 50 entries, 10min TTL)
  - Consider worker threads for parsing if files exceed threshold

**DataCache could be more aggressive:**
- Problem: Cache size limited to 50 entries with 10min TTL; may evict frequently accessed sessions
- Files: `src/main/services/infrastructure/DataCache.ts:34`
- Cause: Conservative cache settings to limit memory usage
- Improvement path:
  - Make cache size configurable based on available memory
  - Implement smarter eviction (frequency-based, not just LRU)
  - Add cache warming for recently accessed projects
  - Monitor cache hit rate and adjust limits

**Virtual scrolling threshold may be too high:**
- Problem: ChatHistory uses virtualization only after 120 items
- Files: `src/renderer/components/chat/ChatHistory.tsx:33` - `VIRTUALIZATION_THRESHOLD = 120`
- Cause: Balance between performance and simplicity
- Improvement path: Lower threshold to 50 or make dynamic based on item complexity

**File watcher polling overhead in SSH mode:**
- Problem: SSH mode polls every 5 seconds instead of using native file watching
- Files: `src/main/services/infrastructure/FileWatcher.ts:76` - `SSH_POLL_INTERVAL_MS = 5000`
- Cause: SFTP doesn't support native file watching
- Improvement path:
  - Increase polling interval for inactive sessions
  - Only poll actively viewed sessions
  - Implement exponential backoff when no changes detected

**React re-renders from array state updates:**
- Problem: Components use `useState` with arrays, triggering re-renders on mutation
- Files: Found in `src/renderer/components/search/CommandPalette.tsx`, `src/renderer/components/settings/NotificationTriggerSettings/hooks/useAddTriggerFormState.ts`
- Cause: React's immutability model
- Improvement path: Use immer for state updates; move to Zustand for complex state; add React.memo() strategically

**Context tracking computation on every turn:**
- Problem: `contextTracker.ts` (1099 lines) recomputes context stats for entire session
- Files: `src/renderer/utils/contextTracker.ts`
- Cause: Comprehensive tracking across 6 categories for all messages
- Improvement path:
  - Memoize computation results
  - Compute incrementally as messages arrive
  - Move computation to web worker for large sessions

## Fragile Areas

**Search highlighting with direct DOM manipulation:**
- Files: `src/renderer/components/chat/ChatHistory.tsx:417-425`
- Why fragile: Directly mutates DOM outside React; tightly coupled to DOM structure
- Safe modification: Changes to chat item rendering may break highlighting; modify `searchHighlightUtils.ts` in parallel
- Test coverage: No automated tests for search highlighting

**File watcher concurrency handling:**
- Files: `src/main/services/infrastructure/FileWatcher.ts:79-82` - concurrency guards with `processingInProgress`, `pendingReprocess` Sets
- Why fragile: Complex state machine with polling, debouncing, catch-up scans, and concurrency guards; edge cases in reconnection
- Safe modification: Test thoroughly with concurrent file changes; validate that reprocessing queue works correctly
- Test coverage: Partial coverage in `test/main/services/infrastructure/FileWatcher.test.ts`

**Tab state synchronization across panes:**
- Files: `src/renderer/store/slices/tabSlice.ts:88-96` - `syncFromLayout()`, pane helpers
- Why fragile: Complex facade pattern synchronizing root state with focused pane; multi-level updates
- Safe modification: Changes to pane layout must maintain backward compatibility with openTabs/activeTabId
- Test coverage: Basic tests in `test/renderer/store/tabSlice.test.ts`

**Subagent resolution with parallel execution detection:**
- Files: `src/main/services/discovery/SubagentResolver.ts` (547 lines)
- Why fragile: Detects parallel execution by analyzing timing; enriches team metadata with color assignments
- Safe modification: Changes to team detection logic could break teammate display; timing heuristics may need tuning
- Test coverage: No automated tests for SubagentResolver

**Auto-scroll with search navigation:**
- Files: `src/renderer/hooks/useAutoScrollBottom.ts:144,178,204,247` - complex effect dependencies
- Why fragile: Multiple setTimeout/RAF coordination; interacts with virtualization, search, and user scroll
- Safe modification: Changes to scroll behavior should be tested with all interaction modes (search, navigation, user scroll)
- Test coverage: Basic tests in `test/renderer/hooks/useAutoScrollBottom.test.ts`

## Scaling Limits

**In-memory session storage:**
- Current capacity: Limited by DataCache (50 sessions) and Zustand store (unbounded arrays)
- Limit: Projects with 1000+ sessions may cause memory issues
- Scaling path:
  - Implement pagination for session lists (already exists via `getSessionsPaginated`)
  - Add session unloading when tabs close
  - Consider IndexedDB for session metadata caching in renderer

**Context injection tracking:**
- Current capacity: All injections tracked for entire session in memory
- Limit: Very long sessions (1000+ turns) will accumulate large context stats
- Scaling path:
  - Compute stats on-demand instead of upfront
  - Store only aggregates, not individual injections
  - Implement rolling window (last N turns)

**Notification storage:**
- Current capacity: Max 100 notifications in `~/.claude/claude-devtools-notifications.json`
- Limit: Hard cap prevents unbounded growth
- Scaling path: Already well-bounded; consider adding pagination UI if 100 is insufficient

**Virtual scrolling limitations:**
- Current capacity: Handles 1000+ items but estimated height may cause jumps
- Limit: Dynamic height items (collapsed/expanded) can cause scroll jank
- Scaling path: Use measured heights instead of estimates; implement "scroll anchoring"

## Dependencies at Risk

**Electron version updates:**
- Risk: Currently on Electron 40.3.0; major version updates may break IPC contracts
- Impact: File watching, native notifications, window management
- Migration plan: Test thoroughly on Electron beta releases; monitor breaking changes in Electron docs

**SSH2 library type coverage:**
- Risk: `ssh2@1.17.0` has incomplete TypeScript types, requiring `as any` casts
- Impact: SSH functionality breaks at runtime, not compile time
- Migration plan: Contribute types to DefinitelyTyped or switch to better-typed SSH library

**React 18 concurrent rendering:**
- Risk: Some components may not be concurrent-safe (direct DOM mutations)
- Impact: Search highlighting, scroll behavior may have race conditions
- Migration plan: Audit all DOM mutations; move to proper React state; enable strict mode

**Zustand store performance:**
- Risk: Large state trees with deep subscriptions cause re-render cascades
- Impact: Noticeable lag on large sessions
- Migration plan: Use `useShallow` more broadly; implement selector memoization; consider Jotai for derived state

## Missing Critical Features

**Offline SSH support:**
- Problem: SSH connections disconnect without graceful degradation
- Blocks: Viewing remote sessions when host unreachable
- Priority: Medium - add cached mode for read-only access

**Session export/archive:**
- Problem: No way to export session data for backup or sharing
- Blocks: Long-term archival, data portability
- Priority: Low - users can manually copy JSONL files

**Undo/redo for configuration:**
- Problem: No way to revert config changes or notification trigger edits
- Blocks: Safe experimentation with triggers
- Priority: Low - manual backup of `~/.claude/config.json` works

## Test Coverage Gaps

**Service layer severely undertested:**
- What's not tested: 38 of 44 service files lack tests (86% untested)
- Files:
  - All infrastructure services except FileWatcher: `ConfigManager.ts`, `NotificationManager.ts`, `SshConnectionManager.ts`, `DataCache.ts` (DataCache has no tests despite complex LRU logic)
  - All discovery services except ProjectScanner, SessionSearcher: `SubagentResolver.ts`, `SubagentLocator.ts`, `WorktreeGrouper.ts`, `SessionContentFilter.ts`
  - All analysis services: `ChunkBuilder.ts` (tested), but `SubagentDetailBuilder.ts`, `SemanticStepExtractor.ts`, `ToolExecutionBuilder.ts` untested
  - All error services: `ErrorDetector.ts`, `ErrorTriggerChecker.ts`, `ErrorMessageBuilder.ts`
  - All parsing services except MessageClassifier, SessionParser: `GitIdentityResolver.ts`, `ClaudeMdReader.ts`
- Risk: Complex business logic could break unnoticed; refactoring is risky
- Priority: High - focus on: DataCache LRU eviction, NotificationManager throttling, SubagentResolver parallel detection, ErrorDetector token counting

**React components completely untested:**
- What's not tested: 126 component files, 0 component tests
- Files: All of `src/renderer/components/` (chat, sidebar, settings, dashboard, layout)
- Risk: UI regressions go unnoticed; interaction bugs not caught
- Priority: Medium - focus on critical paths: ChatHistory rendering, search functionality, tab management

**IPC handlers have minimal coverage:**
- What's not tested: Most IPC handlers in `src/main/ipc/` lack integration tests
- Files: `config.ts` (628 lines, 0% coverage), `sessions.ts`, `notifications.ts`, `ssh.ts`
- Risk: Handler crashes or incorrect responses not caught
- Priority: Medium - guards.ts has 53% coverage; add handler-level tests

**Store slices partially tested:**
- What's not tested: 6 of 12 slices tested; missing: `projectSlice`, `repositorySlice`, `sessionDetailSlice`, `subagentSlice`, `conversationSlice`, `configSlice`
- Files: `test/renderer/store/` has tests for `notificationSlice`, `paneSlice`, `sessionSlice`, `tabSlice`, `tabUISlice`
- Risk: State mutations may have side effects; action creators could have bugs
- Priority: Medium - focus on complex slices: sessionDetailSlice, conversationSlice

**Context tracking logic untested:**
- What's not tested: `contextTracker.ts` (1099 lines) has no tests
- Files: `src/renderer/utils/contextTracker.ts`, `src/renderer/utils/claudeMdTracker.ts`
- Risk: Context stats computation could be wrong; token counting inaccurate
- Priority: High - this is a core feature; add comprehensive tests for all 6 injection categories

**Utility functions have good coverage:**
- What's tested: `jsonl.ts`, `pathDecoder.ts`, `pathValidation.ts`, `regexValidation.ts`, `tokenizer.ts`, formatters, date grouping
- Coverage: Core parsing and utility logic is well-tested
- Priority: Low - maintain current coverage

---

*Concerns audit: 2026-02-12*
