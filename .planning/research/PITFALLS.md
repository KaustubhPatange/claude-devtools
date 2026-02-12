# Pitfalls Research

**Domain:** Multi-context workspace switching for Electron + Zustand apps
**Researched:** 2026-02-12
**Confidence:** HIGH

---

## Critical Pitfalls

### Pitfall 1: Destructive Context Switching with Incomplete State Snapshots

**What goes wrong:**
Switching from SSH to local (or vice versa) calls `getFullResetState()` which wipes ALL selections and loaded data, destroying the user's previous workspace state. When switching back, users must re-navigate to their project, re-open sessions, and restore their scroll position manually.

**Why it happens:**
Current implementation treats context switch as a "hard reset" instead of maintaining separate state snapshots per context. The `connectionSlice` spreads `getFullResetState()` on connect/disconnect, clearing `selectedProjectId`, `selectedSessionId`, `conversation`, tabs, and all derived state.

**How to avoid:**
- **Snapshot before switching**: Capture full AppState before connect/disconnect
- **Scope snapshots by context**: Use `Map<'local' | SshHostKey, AppState>` to store separate state per context
- **Partial restoration**: Only restore state compatible with the new context (project IDs may differ between local/SSH)
- **Preserve UI preferences**: Tab layout, expanded groups, scroll positions are context-agnostic and should always restore

**Warning signs:**
- User complaints about "losing their place" when switching contexts
- Empty dashboard after SSH connect, despite having viewed sessions before
- No tabs open after switching back to local mode
- Context panel expansions reset on every switch

**Phase to address:**
Phase 1 (Core Infrastructure) — state snapshot/restore must be foundational before adding multi-context features.

---

### Pitfall 2: EventEmitter Listener Accumulation on Repeated Context Switches

**What goes wrong:**
FileWatcher, SshConnectionManager, and NotificationManager are EventEmitters. Each context switch may call `setFileSystemProvider()` or re-initialize services without removing old listeners, causing:
- Memory leaks (listeners hold references to previous provider instances)
- Duplicate event emissions (one event triggers 2x, 3x handlers)
- Stale event handlers executing against wrong context

**Why it happens:**
Services use `.on()` to attach listeners but don't call `.removeAllListeners()` or track cleanup functions. The `initializeNotificationListeners()` function in store/index.ts returns a cleanup function, but there's no guarantee it's called before re-initialization.

**How to avoid:**
- **Centralized cleanup**: Create `dispose()` methods for all EventEmitter services
- **Lifecycle tracking**: Maintain `Map<string, () => void>` of cleanup functions keyed by service name
- **Pre-switch cleanup**: Call all cleanup functions BEFORE provider swap
- **Idempotent initialization**: Check `if (this.isInitialized) return` to prevent double-init
- **Avoid `removeAllListeners()` on ipcRenderer**: Always specify channel name — blanket removal breaks Electron internals

**Warning signs:**
- Process memory usage (RSS) grows 50-100MB per context switch
- DevTools heap snapshot shows multiple FileWatcher/SshConnectionManager instances
- Console logs show duplicate "file-change" events for same file
- IPC handlers fire 2x for single user action

**Phase to address:**
Phase 1 (Core Infrastructure) — service lifecycle management is critical before multi-context.

**Sources:**
- [Error: Removing all listeners from ipcRenderer will make Electron internals stop working](https://github.com/electron/electron/issues/10379)
- [IPC in Electron - Ray](https://myray.app/blog/ipc-in-electron)

---

### Pitfall 3: Stale Closures in Zustand Actions Capturing Old Provider References

**What goes wrong:**
Zustand actions like `fetchProjects()` capture the FileSystemProvider in their closure at store creation time. After calling `sshConnectionManager.getProvider()` which returns a new SshFileSystemProvider, existing actions still reference the old LocalFileSystemProvider, causing operations to execute against the wrong context.

**Why it happens:**
JavaScript closures capture variables at definition time. When a Zustand action calls `window.electronAPI.getProjects()`, the IPC handler calls `projectScanner.scan()`, which calls `this.fsProvider.readdir()`. If the scanner's provider reference wasn't updated, it uses the stale provider.

**How to avoid:**
- **Late binding via getter**: Services should call `getProvider()` on every operation, not cache at construction
- **Provider as parameter**: Pass provider explicitly to service methods instead of storing as instance variable
- **Re-initialize services**: After provider swap, call `fileWatcher.setFileSystemProvider(newProvider)` on ALL services
- **Service registry pattern**: Centralize provider injection so swap happens in one place
- **Verify in tests**: Mock provider swap and assert service calls hit new provider

**Warning signs:**
- SSH connect succeeds but dashboard shows local projects
- File operations fail with "ENOENT" after provider swap
- Console shows "LocalFileSystemProvider" operations when SSH is connected
- User switches to SSH but sees local data until app restart

**Phase to address:**
Phase 1 (Core Infrastructure) — provider injection architecture must be correct from the start.

**Sources:**
- [Be Aware of Stale Closures when Using React Hooks](https://dmitripavlutin.com/react-hooks-stale-closures/)
- [How to Fix "Stale Closure" Issues in React Hooks](https://oneuptime.com/blog/post/2026-01-26-fix-stale-closure-issues-react-hooks/view)

---

### Pitfall 4: IPC Race Conditions During Context Switch with In-Flight Requests

**What goes wrong:**
User clicks "Connect SSH" → IPC handler starts scanning remote projects → user quickly clicks "Disconnect" → scan completes and populates store with SSH data → store now shows SSH projects in local mode, creating data corruption.

**Why it happens:**
Async IPC calls (getProjects, getSessions) don't track which context initiated them. By the time a response arrives, the context may have switched, but Zustand applies the stale response anyway.

**How to avoid:**
- **Context ID stamping**: Include `contextId` (UUID per connection) in every IPC request/response
- **Response validation**: Check `if (currentContextId !== response.contextId) return` before applying
- **Request cancellation**: Track in-flight requests via AbortController and cancel on context switch
- **State machine**: Use FSM with states: `idle → connecting → connected → disconnecting → idle`. Reject operations in wrong states.
- **Sequential transitions**: Wait for disconnect cleanup to complete before starting connect

**Warning signs:**
- Dashboard briefly flickers between local and SSH data during transitions
- Error notifications appear for wrong context after switching
- Search results from previous context appear after switch
- Console shows "Cannot read property of null" after rapid connect/disconnect

**Phase to address:**
Phase 1 (Core Infrastructure) — race condition prevention is non-negotiable for reliability.

**Sources:**
- [Syncing State between Electron Contexts](https://brunoscheufler.com/blog/2023-10-29-syncing-state-between-electron-contexts)
- [Advanced Electron.js architecture - LogRocket Blog](https://blog.logrocket.com/advanced-electron-js-architecture/)

---

### Pitfall 5: FileWatcher Polling Timer Not Cleared on SSH Disconnect

**What goes wrong:**
SSH mode uses `setInterval()` polling (5s) instead of fs.watch(). When user disconnects, `stop()` clears `pollingTimer`, but the cleanup happens in `finally` block — if an exception occurs, timer keeps running. After 10 switches, 10 polling timers consume CPU checking a disconnected SSH provider.

**Why it happens:**
Interval timers require explicit `clearInterval()`, and error paths may skip cleanup. The `pollingTimer` property is set to null without actually clearing the interval, causing orphaned timers.

**How to avoid:**
- **Cleanup in finally**: Always clear timers in `finally` block, not just normal path
- **Defensive clearing**: Before creating new timer, clear existing: `if (this.timer) clearInterval(this.timer)`
- **Timer registry**: Track all active timers in Set<NodeJS.Timeout> and clear all on dispose
- **Polling refactor**: Consider using a single interval that checks `isRemote()` flag instead of separate modes
- **Memory profiling**: Add setInterval/clearInterval tracking to detect orphaned timers

**Warning signs:**
- CPU usage increases by 5-10% per context switch
- Chrome DevTools → Performance shows multiple "pollForChanges" concurrent executions
- Memory usage grows 20MB per switch (timer closures hold provider references)
- App becomes sluggish after 5-10 SSH switches

**Phase to address:**
Phase 1 (Core Infrastructure) — timer lifecycle bugs cause performance degradation.

---

### Pitfall 6: SSH Connection Not Properly Disposed, Keeping Socket Open

**What goes wrong:**
`SshConnectionManager.disconnect()` calls `client.end()`, but if the SFTP channel is still processing operations, the socket remains open (TCP FIN not sent). After 10 context switches, 10 SSH connections consume file descriptors and remote server resources.

**Why it happens:**
ssh2 Client `.end()` is graceful (waits for channel closure), but `.destroy()` is immediate. If you don't wait for SFTP operations to complete before calling `.end()`, the connection may linger. The `dispose()` method swallows errors, hiding cleanup failures.

**How to avoid:**
- **Force close on disconnect**: Use `client.destroy()` instead of `.end()` for immediate termination
- **SFTP channel close**: Call `sftp.end()` explicitly before `client.end()`
- **Connection timeout**: Set 5s timeout on disconnect — if client doesn't close, force destroy
- **Socket tracking**: Expose `net.Socket` from Client and verify `socket.destroyed === true` post-cleanup
- **Resource monitoring**: Log open file descriptors (lsof) to detect leaks

**Warning signs:**
- `lsof -p <pid>` shows 10+ TCP connections to SSH host
- SSH host reports "Max sessions exceeded" after many switches
- `netstat` shows multiple ESTABLISHED connections to port 22
- Disconnect takes 5+ seconds (waiting for timeout)

**Phase to address:**
Phase 1 (Core Infrastructure) — connection leaks cause operational issues at scale.

**Sources:**
- [Diagnosing and Fixing Memory Leaks in Electron Applications](https://www.mindfulchase.com/explore/troubleshooting-tips/frameworks-and-libraries/diagnosing-and-fixing-memory-leaks-in-electron-applications.html)
- [Viacheslav Eremin | Memory Leaks in Electron application](https://www.vb-net.com/AngularElectron/MemoryLeaks.htm)

---

### Pitfall 7: Tab State Restoration Without Context Validation

**What goes wrong:**
Snapshot captures open tabs with `projectId: "abc-local-path"`. User switches to SSH where projects have different IDs. Restoration tries to open tab with local projectId against SSH provider → tab shows "Project not found" error or stale local data.

**Why it happens:**
ProjectId encoding includes file path (`-Users-name-project`), so local and SSH projects for the same logical directory have different IDs. Tab restoration doesn't validate whether a project exists in the new context.

**How to avoid:**
- **Path normalization**: Introduce `logicalProjectPath` (e.g., `/home/user/project`) separate from encoded ID
- **Cross-context mapping**: Maintain `Map<logicalPath, {localId, sshId}>` to translate IDs during restore
- **Graceful degradation**: If project doesn't exist in new context, close tab or show empty state instead of error
- **Restore validation**: Before applying snapshot, call `window.electronAPI.getProjects()` and filter tabs to existing projects
- **User notification**: Show toast "3 tabs closed - projects not available in SSH mode"

**Warning signs:**
- User switches to SSH, tabs show "Failed to load session"
- Console errors "Project ID abc-local not found" after context switch
- Tab bar shows ghost tabs (visible but non-functional)
- Click on restored tab triggers navigation to dashboard instead

**Phase to address:**
Phase 2 (State Persistence) — after Phase 1 establishes snapshots, validation ensures safe restoration.

---

### Pitfall 8: Partial Snapshot Creates Inconsistent Derived State

**What goes wrong:**
Snapshot captures `selectedProjectId`, `selectedSessionId`, but omits `sessionDetail`, `conversation`, `chunks`. Restoration sets selections without corresponding data → store state says "session XYZ selected" but detail is null → UI renders empty or crashes on null access.

**Why it happens:**
Developers manually list fields to snapshot instead of capturing full AppState. Derived state (detail, conversation) is computed from selections, but if selections restore before data loads, the UI sees inconsistent state.

**How to avoid:**
- **Snapshot everything**: Capture `AppState` wholesale, excluding only ephemeral UI flags (loading, error)
- **Atomic restoration**: Use `setState(() => snapshot)` so all fields update simultaneously
- **Lazy detail loading**: On restoration, if `selectedSessionId` exists but `sessionDetail` is null, trigger background fetch
- **State versioning**: Include `snapshotVersion: 1` to handle schema changes (e.g., new fields added)
- **Whitelist vs blacklist**: Easier to exclude ephemeral fields (`loading`, `error`) than enumerate 50+ persistent fields

**Warning signs:**
- After switch, session viewer shows spinner indefinitely
- Console error "Cannot read property 'chunks' of null"
- Dashboard shows selected project but no sessions loaded
- Tab labels show "undefined" or "[object Object]"

**Phase to address:**
Phase 1 (Core Infrastructure) — snapshot completeness is foundational to state restoration.

**Sources:**
- [Zustand - react state management made easy](https://graphqleditor.com/blog/zustand/)

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| **Storing provider as instance variable** | Simple, no getter needed | Stale closure bugs on provider swap | Never — always use getter |
| **Not tracking cleanup functions** | Less boilerplate code | Memory leaks accumulate with usage | Never — cleanup is mandatory |
| **Hard reset on context switch** | Easy to implement (3 lines) | User loses workspace state | Never — destroys UX |
| **Using `removeAllListeners()`** | Clears everything at once | Breaks Electron IPC internals | Never — specify channel |
| **Sync IPC for connect** | Blocks until complete | UI freezes 2-5s on slow networks | Never — SSH is async |
| **Single global DataCache** | Shared cache across contexts | Cache pollution (local data in SSH mode) | Never — scope cache per context |
| **Manual field-by-field snapshot** | Fine-grained control | Fragile, breaks when state schema evolves | Only for specific performance tuning |
| **Not versioning snapshots** | Don't need migration code | Can't safely restore after app updates | Only in MVP — add versioning in Phase 2 |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **SSH2 Client** | Using `.end()` without waiting for SFTP close | Call `sftp.end()`, wait 100ms, then `client.destroy()` |
| **SFTP operations** | Not catching ENOENT on remote path access | Wrap all `sftp.stat()` in try/catch, validate paths exist |
| **IPC context bridge** | Passing large objects (10MB+ session JSON) | Stream via chunks or use temp file + file path |
| **FileWatcher SSH polling** | Polling every 1s (too aggressive) | 5s minimum — SSH has latency |
| **Zustand subscriptions** | Subscribing to full store on every render | Use selectors: `useStore((s) => s.field, shallow)` |
| **React useEffect** | Empty deps array with state access | Include all state in deps or use functional updates |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| **Cache not scoped by context** | Search returns SSH results in local mode | Separate caches: `localCache`, `sshCache` | After first context switch |
| **Snapshot entire 50MB state** | 500ms freeze during switch | Exclude non-serializable (functions, DOM refs) | 10+ open sessions |
| **No debounce on provider swap events** | 10 re-renders per switch | Debounce 100ms, batch provider updates | Rapid switching (QA testing) |
| **Loading all tabs eagerly** | UI freezes restoring 20 tabs | Virtual scrolling + lazy load tab content | 10+ open tabs |
| **Not canceling in-flight IPC** | Stale responses overwrite new data | AbortController per IPC call | Slow network (SSH over VPN) |
| **Synchronous validation during snapshot** | Blocks UI during switch | Validate asynchronously post-restoration | Large state (100+ projects) |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| **Storing SSH passwords in snapshot** | Plaintext credentials in memory dump | Never snapshot credentials — only host/port/user |
| **Not validating SSH host keys** | MITM attacks | Use ssh2 `hostVerifier` callback, check known_hosts |
| **Exposing SSH provider to renderer** | Renderer can execute arbitrary commands | Keep provider in main process only, expose via IPC |
| **Logging full AppState snapshots** | Sensitive data in logs | Redact: `password`, `privateKey`, `sessionContent` |
| **Not sanitizing project paths** | Path traversal attacks | Validate paths with `path.resolve()`, reject ".." |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| **No visual feedback during switch** | User doesn't know if click worked | Show connecting spinner + progress bar |
| **Immediate switch without confirmation** | Accidental clicks lose workspace | "Switch will close X tabs. Continue?" dialog |
| **No indication of current context** | User forgets if in local/SSH | Persistent badge in header: "Local" or "SSH: hostname" |
| **Context switch closes all tabs** | User loses 10+ open sessions | Restore tabs if projects exist in new context |
| **No way to view both contexts** | Can't compare local vs SSH data | Split view or dual panes (future enhancement) |
| **Errors shown as raw exceptions** | "ENOTFOUND" means nothing to user | Friendly: "Cannot connect to SSH host. Check network." |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Context switch** — Looks like it works because SSH connects, but missing: cleanup old listeners, cancel in-flight IPC, validate restored tabs
- [ ] **State snapshot** — Appears to save state, but missing: exclude ephemeral fields, version snapshots, validate restorable
- [ ] **Provider swap** — FileWatcher updated, but missing: update ProjectScanner, SessionParser, ErrorDetector, NotificationManager
- [ ] **Tab restoration** — Tabs re-open, but missing: validate project exists, load session detail, restore scroll position
- [ ] **IPC request tracking** — Responses return, but missing: context ID validation, abort on disconnect, timeout handling
- [ ] **Service dispose** — dispose() method exists, but missing: remove EventEmitter listeners, clear timers, close connections
- [ ] **Cache invalidation** — Cache cleared on switch, but missing: scope cache per context, invalidate on reconnect
- [ ] **Error handling** — Try/catch present, but missing: rollback state on failure, show user-friendly message, log to sentry

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| **Destructive switch lost state** | MEDIUM | Phase 2: Add persistent storage (localStorage) to survive restarts |
| **Listener leaks** | LOW | Add dispose tracking, expose `debug.listenerCount()` IPC for diagnosis |
| **Stale closure** | HIGH | Refactor service architecture to inject provider per call (breaking change) |
| **IPC race condition** | MEDIUM | Add context ID retroactively, reject responses with mismatched ID |
| **Timer leak** | LOW | DevTools audit: setInterval/clearInterval coverage, add cleanup tests |
| **SSH connection leak** | LOW | Add connection pool with max limit, force destroy after 30s timeout |
| **Tab validation missing** | MEDIUM | Add migration: filter invalid tabs on app startup |
| **Partial snapshot** | HIGH | Ship hotfix: capture full state, deprecate manual field list |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Destructive context switching | Phase 1 | Unit test: switch → switch back → assert state restored |
| EventEmitter listener accumulation | Phase 1 | Memory profiler: assert RSS stable after 10 switches |
| Stale closures | Phase 1 | Integration test: mock provider swap, assert service calls new provider |
| IPC race conditions | Phase 1 | E2E test: rapid connect/disconnect, assert no stale data |
| FileWatcher polling timer | Phase 1 | Unit test: call stop(), assert pollingTimer cleared |
| SSH connection disposal | Phase 1 | Integration test: assert socket.destroyed after disconnect |
| Tab restoration validation | Phase 2 | E2E test: open tabs → switch SSH → assert only valid tabs restored |
| Partial snapshot | Phase 1 | Integration test: snapshot → restore → assert detail populated |

---

## Sources

### Official Documentation
- [Electron IPC Documentation](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Electron ipcRenderer API](https://www.electronjs.org/docs/api/ipc-renderer)
- [Node.js Events API](https://nodejs.org/api/events.html)

### Electron State Management
- [Syncing State between Electron Contexts - Bruno Scheufler](https://brunoscheufler.com/blog/2023-10-29-syncing-state-between-electron-contexts)
- [Advanced Electron.js architecture - LogRocket Blog](https://blog.logrocket.com/advanced-electron-js-architecture/)
- [Zutron: Streamlined Electron State Management](https://github.com/goosewobbler/zutron)
- [Notes on Electron Processes, Context Isolation, and IPC](https://abstractentropy.com/notes-on-electron/)

### Memory Leaks and Cleanup
- [Diagnosing and Fixing Memory Leaks in Electron Applications](https://www.mindfulchase.com/explore/troubleshooting-tips/frameworks-and-libraries/diagnosing-and-fixing-memory-leaks-in-electron-applications.html)
- [Viacheslav Eremin | Memory Leaks in Electron application](https://www.vb-net.com/AngularElectron/MemoryLeaks.htm)
- [Error: Removing all listeners from ipcRenderer](https://github.com/electron/electron/issues/10379)
- [IPC in Electron - Ray](https://myray.app/blog/ipc-in-electron)

### React Stale Closures
- [Be Aware of Stale Closures when Using React Hooks](https://dmitripavlutin.com/react-hooks-stale-closures/)
- [How to Fix "Stale Closure" Issues in React Hooks](https://oneuptime.com/blog/post/2026-01-24-fix-stale-closure-issues-react-hooks/view)
- [React Stale Closure: Common Problems and Easy Solutions](https://www.dhiwise.com/post/react-stale-closure-common-problems-and-easy-solutions)
- [Hooks, Dependencies and Stale Closures | TkDodo's blog](https://tkdodo.eu/blog/hooks-dependencies-and-stale-closures)

### Zustand and State Management
- [Zustand - react state management made easy](https://graphqleditor.com/blog/zustand/)
- [Stores with React Context: Memory Leak Issue or Redux DevTools Bug?](https://github.com/pmndrs/zustand/discussions/2540)
- [In an ESModule, will not cleaning up subscriber result in a memory leak?](https://github.com/pmndrs/zustand/discussions/2054)

### VS Code Multi-Root Workspaces (Reference Architecture)
- [Adopting Multi Root Workspace APIs](https://github.com/microsoft/vscode/wiki/Adopting-Multi-Root-Workspace-APIs)
- [Multi-Root Workspaces in VS Code](https://code.visualstudio.com/docs/editing/workspaces/multi-root-workspaces)
- [Workspace Management: Multi-project VS Code Setup](https://www.mikul.me/blog/workspace-management-multi-project-vscode-setup)

### Dependency Injection and Service Lifecycle
- [Dependency injection guidelines - .NET](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/guidelines)
- [Service lifetimes (dependency injection) - .NET](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/service-lifetimes)
- [TSyringe: Lightweight dependency injection for TypeScript](https://github.com/microsoft/tsyringe)

---

*Pitfalls research for: Multi-context workspace switching in Electron + Zustand*
*Researched: 2026-02-12*
