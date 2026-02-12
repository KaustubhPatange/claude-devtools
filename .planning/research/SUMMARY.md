# Project Research Summary

**Project:** Multi-Context Workspace Management for claude-devtools
**Domain:** Electron desktop application with SSH remote + local context switching
**Researched:** 2026-02-12
**Confidence:** HIGH

## Executive Summary

Multi-context workspace switching in Electron desktop applications requires a careful balance of instant switching, comprehensive state preservation, and robust resource lifecycle management. Research across VS Code Remote, JetBrains Gateway, Slack, and Notion reveals that users demand sub-second context switches with zero data loss and continuous connection awareness. The recommended approach centers on three architectural pillars: (1) a ServiceContextRegistry pattern to maintain separate service instances per context, avoiding expensive teardown/recreation; (2) Zustand state snapshots with IndexedDB persistence for instant restoration; (3) BroadcastChannel API for multi-window synchronization, eliminating the complexity of IPC-based window coordination.

The critical insight from research is that "destructive switching" (clearing all state on context change) is the primary UX killer. Users switching between local and SSH contexts expect their open sessions, selected projects, tab layout, and scroll positions to be preserved per context. VS Code Remote and Slack demonstrate that this is achievable through snapshot-based state management with context validation—when switching back to SSH, the app should restore exactly where the user left off, not force re-navigation. The technology stack already in place (Zustand 4.x, Electron 28.x, ssh2) fully supports this pattern through persist middleware with selective hydration control and workspace-scoped storage keys.

The most dangerous pitfall identified is the combination of EventEmitter listener accumulation and stale closures capturing old FileSystemProvider references. After 5-10 context switches, memory leaks from orphaned listeners (FileWatcher polling timers, SSH connections, IPC subscriptions) can consume 50-100MB per switch while services continue calling methods on the wrong provider. Prevention requires explicit lifecycle management: every service must implement a `dispose()` method that clears timers, removes listeners, and closes connections, coupled with late-binding provider injection (getter pattern instead of constructor caching) to avoid closure staleness. The roadmap must address these lifecycle issues in Phase 1 before any user-facing features, as retrofitting proper cleanup after discovering production memory leaks is expensive and risky.

## Key Findings

### Recommended Stack

Research confirms that the existing stack (Zustand 4.x, Electron 28.x, ssh2) is well-suited for multi-context workspace management. The key addition is leveraging Zustand's persist middleware with IndexedDB storage (via idb-keyval) for inactive workspace snapshots, combined with BroadcastChannel API for multi-window synchronization. The ServiceContextRegistry pattern provides the architectural backbone—a main-process registry that owns service instances per context (local + N SSH hosts), eliminating expensive service recreation on every switch.

**Core technologies:**
- **Zustand persist middleware**: State snapshot/restoration per workspace with selective hydration control (`skipHydration`, `rehydrate`, `partialize`)—already in use, no new dependencies
- **ServiceContextRegistry pattern**: Map of contextId → ServiceContext (FileSystemProvider + service instances), provides `getActive()`, `switch()`, lifecycle management
- **BroadcastChannel API**: Native browser API for same-origin window messaging, used by VS Code Remote and Akiflow for multi-window state sync—zero dependencies
- **IndexedDB via idb-keyval**: Async storage for inactive workspace snapshots, avoids localStorage 5MB quota limits—only new dependency (600 bytes minified)
- **IPC workspace-scoped channels**: Prefix channels with contextId (`workspace:${contextId}:getSessions`) for context-aware request routing through main process registry

**Critical version requirements:**
- Zustand 4.x includes persist middleware (no separate install)
- Electron 28.x+ includes BroadcastChannel (native in Chromium 54+)
- idb-keyval 6.x compatible with TypeScript 5.x

**What NOT to use:**
- Zutron library (designed for syncing single store across main+renderer, not multiple independent workspace stores)
- Redux/Redux Toolkit (overkill for context switching, unnecessary boilerplate)
- Global store with workspace slice pattern (scales poorly, makes persistence complex)

### Expected Features

Multi-context applications have a clear division between table stakes (users will leave if missing) and differentiators (competitive advantage but not required). Research across VS Code Remote, JetBrains Gateway, Slack, Notion, Discord, and Figma establishes the feature baseline.

**Must have (table stakes):**
- **Visual workspace list with status** — users expect to see available workspaces at a glance (dropdown, sidebar, or command palette)
- **Saved connection profiles** — users refuse to re-enter SSH details (host, port, username) repeatedly
- **Recent connections list** — 80%+ of switches go to recent contexts (default 5-10 most recent)
- **Current workspace indicator** — users need persistent "where am I?" awareness (status bar or title bar badge)
- **Per-workspace state preservation** — context loss on switch = immediate frustration (open files, selections, scroll position, tabs, UI state)
- **Connection status indicators** — real-time online/connecting/offline/error states with distinct visual treatment
- **Loading indicators during switch** — delays without feedback feel like freezes (skeleton states or spinners)
- **Basic error handling** — clear messages with actionable guidance, not raw exceptions
- **Keyboard shortcut for switcher** — power users demand keyboard-driven workflows (Ctrl/Cmd+K pattern)

**Should have (competitive):**
- **Quick switcher with fuzzy search** — fastest method for 10+ workspaces (Cmd+K command palette pattern)
- **Auto-reconnect on network restore** — brief network blips shouldn't require manual reconnection (exponential backoff, max 6-10 retries)
- **Workspace color coding** — visual distinction reduces cognitive load (Discord/Slack pattern)
- **Connection health metrics** — latency, stability indicators provide proactive awareness
- **Activity notifications** — unread indicators per workspace, stay informed without switching
- **Context preview on hover** — reduce cognitive load by showing context before full switch (Slack's tab preview pattern)

**Defer (v2+):**
- **Parallel workspace windows** — advanced users want simultaneous multi-context view (HIGH complexity, resource isolation challenges)
- **Offline-first with sync queue** — continue working during network issues (HIGH complexity, requires conflict resolution)
- **Workspace groups/folders** — hierarchical organization only needed at 50+ workspaces
- **Context-aware AI suggestions** — predict next workspace based on patterns (HIGH complexity, requires ML infrastructure)
- **Workspace-specific keyboard shortcuts** — per-workspace customization (HIGH complexity, potential confusion)

**Explicitly avoid (anti-features):**
- Automatic workspace switching (destroys mental model)
- Unlimited parallel workspaces (resource exhaustion)
- Real-time sync of all state (network overhead, conflict complexity)
- Complex workspace hierarchies (cognitive overhead)
- Cross-workspace clipboard sync (security issue)

### Architecture Approach

The recommended architecture uses a ServiceContextRegistry pattern in the main process to manage multiple isolated service contexts, each with its own FileSystemProvider and service instances. This avoids expensive teardown/recreation on every switch and maintains separate caches per context. The renderer uses workspace-scoped Zustand stores with state snapshots captured in IndexedDB for instant restoration. IPC handlers are re-routed through the registry's `getActive()` method rather than using module-level service variables, eliminating the need for `reinitializeServiceHandlers()` on every switch.

**Major components:**
1. **ServiceContextRegistry (main)** — Central registry managing multiple ServiceContext instances (local + N SSH), provides `getActive()`, `switch()`, `register()`, handles lifecycle (start/stop watchers, dispose inactive contexts)
2. **ServiceContext (main)** — Encapsulates service instances for one context: ProjectScanner, SessionParser, SubagentResolver, DataCache, FileWatcher, plus FileSystemProvider reference—isolated state per context
3. **ContextSwitcher (renderer)** — Orchestrates context switches: captures current state snapshot, calls IPC to switch, restores target state from IndexedDB, triggers background data refresh
4. **StateSnapshot (renderer)** — Frozen copy of AppState per context (projects, sessions, selections, tabs, pane layout) with expiration timestamp (5-minute TTL)—instant restore if fresh, partial restore + re-fetch if stale
5. **IPC Context Handlers** — Expose `getCurrentContext()`, `switchContext(contextId)`, `listContexts()`, `getContextSnapshot(contextId)` via preload bridge

**Key architectural decisions:**
- Local context always stays alive (never disposed) for notifications and config updates
- Only active context's FileWatcher runs; inactive watchers are paused to conserve resources
- Snapshots stored with `contextId` + `expiresAt` to handle stale data (older than 5 minutes triggers background refresh)
- Each ServiceContext has its own DataCache to prevent cache pollution (local data appearing in SSH mode)
- BroadcastChannel syncs context switches across multiple app windows without IPC round-trips

### Critical Pitfalls

Research identified eight critical pitfalls that must be prevented from Phase 1. The most dangerous ones combine to create subtle bugs that manifest only after repeated context switches.

1. **Destructive context switching with incomplete state snapshots** — Current implementation calls `getFullResetState()` on SSH connect/disconnect, wiping all selections, open tabs, and loaded data. When switching back, users must re-navigate to their project and re-open sessions. **Fix:** Capture full AppState snapshot before switching, store in `Map<contextId, AppState>`, restore on switch. Phase 1 critical.

2. **EventEmitter listener accumulation on repeated switches** — FileWatcher, SshConnectionManager use `.on()` without cleanup, causing memory leaks (50-100MB per switch) and duplicate event emissions. **Fix:** Every service implements `dispose()` method with `removeAllListeners(channelName)` (never blank `removeAllListeners()` which breaks Electron IPC), track cleanup functions in registry. Phase 1 critical.

3. **Stale closures capturing old FileSystemProvider references** — Zustand actions and service methods capture provider at definition time. After SSH connect swaps provider, operations still hit old LocalFileSystemProvider. **Fix:** Use getter pattern (`getProvider()` on every operation) instead of constructor caching, or re-initialize services after provider swap. Phase 1 critical.

4. **IPC race conditions during context switch with in-flight requests** — User clicks Connect → IPC starts scanning remote projects → user clicks Disconnect → scan completes and populates store with SSH data in local mode. **Fix:** Include `contextId` UUID in every IPC request/response, validate `if (currentContextId !== response.contextId) return` before applying. Use AbortController to cancel in-flight requests on switch. Phase 1 critical.

5. **FileWatcher polling timer not cleared on SSH disconnect** — SSH mode uses `setInterval()` polling (5s). If error occurs in `stop()`, `clearInterval()` never runs, leaving orphaned timers. After 10 switches, 10 timers consume CPU. **Fix:** Always clear timers in `finally` block, defensive clearing before creating new timer. Phase 1 critical.

6. **SSH connection not properly disposed, keeping socket open** — `client.end()` is graceful but if SFTP channel is processing, socket stays open. After 10 switches, 10 SSH connections consume file descriptors. **Fix:** Call `sftp.end()` explicitly before `client.end()`, set 5s timeout and force `client.destroy()` if graceful close fails. Phase 1 critical.

7. **Tab state restoration without context validation** — Snapshot captures tabs with `projectId: "abc-local-path"`, user switches to SSH where projects have different IDs, restoration tries to open tab with local projectId → "Project not found" error. **Fix:** Validate restored tabs against `window.electronAPI.getProjects()`, close invalid tabs with user notification. Phase 2 priority.

8. **Partial snapshot creates inconsistent derived state** — Snapshot captures `selectedProjectId` but omits `sessionDetail`/`conversation`/`chunks`, restoration sets selection without data → UI renders empty or crashes on null access. **Fix:** Snapshot entire AppState except ephemeral flags (`loading`, `error`), restore atomically via `setState(() => snapshot)`. Phase 1 critical.

## Implications for Roadmap

Based on combined research, the roadmap must prioritize infrastructure over features. Six of eight critical pitfalls must be resolved in Phase 1 before any user-facing context switching is exposed—memory leaks, stale closures, and race conditions will cause production incidents if not addressed foundationally.

### Phase 1: Core Infrastructure (Foundation)
**Rationale:** Main process architecture and lifecycle management must be bulletproof before renderer integration. Memory leaks, stale closures, and race conditions cannot be retrofitted after user-facing features ship.

**Delivers:**
- ServiceContextRegistry in main process managing multiple ServiceContext instances
- IPC context API (getCurrentContext, switchContext, listContexts)
- Service lifecycle management: dispose() methods, EventEmitter cleanup, timer cleanup
- StateSnapshot system with capture/restore in renderer
- Context ID stamping for IPC request/response validation

**Addresses pitfalls:**
- #1 Destructive switching (snapshot system)
- #2 Listener accumulation (dispose methods)
- #3 Stale closures (getActive() pattern)
- #4 IPC race conditions (contextId stamping)
- #5 Timer leaks (finally block cleanup)
- #6 SSH connection leaks (explicit sftp.end() + timeout)
- #8 Partial snapshots (full AppState capture)

**Key features from FEATURES.md:**
- Per-workspace state preservation (table stakes)
- Saved connection profiles (table stakes)

**Build order:**
1. ServiceContext.ts + ServiceContextRegistry.ts (main)
2. IPC context handlers + preload API
3. stateSnapshot.ts + contextSlice.ts (renderer)
4. Service dispose() methods + cleanup tracking

**Research flag:** Standard patterns—ServiceContextRegistry uses established DI container patterns, Zustand persist is well-documented. No additional research needed.

### Phase 2: Basic UI Integration (MVP)
**Rationale:** With infrastructure stable, add minimal UI to expose context switching to users. Focus on table stakes features that users expect.

**Delivers:**
- ContextSwitcher UI component (dropdown or sidebar)
- Current workspace indicator in title bar/status bar
- Connection status indicators (online/connecting/offline/error)
- Loading states during switch
- Basic error handling with user-friendly messages
- Keyboard shortcut (Cmd/Ctrl+K) to open switcher

**Uses stack from STACK.md:**
- Zustand persist with IndexedDB (idb-keyval)
- BroadcastChannel for multi-window sync

**Implements architecture from ARCHITECTURE.md:**
- ContextSwitcher component
- useContextSwitch hook

**Addresses pitfall:**
- #7 Tab validation (validate restored tabs, close invalid)

**Key features from FEATURES.md:**
- Visual workspace list with status (table stakes)
- Recent connections list (table stakes)
- Current workspace indicator (table stakes)
- Connection status indicators (table stakes)
- Loading indicators (table stakes)
- Basic error handling (table stakes)
- Keyboard shortcut for switcher (table stakes)

**Research flag:** Standard patterns—workspace switcher UI follows VS Code/Slack patterns. Status indicators use established color-coding (green/yellow/red). No additional research needed.

### Phase 3: Enhanced UX (v1.x)
**Rationale:** After validating core switching works, add features that significantly improve UX based on user feedback and analytics. Only add when usage data shows need (10+ workspaces, frequent network blips).

**Delivers:**
- Quick switcher with fuzzy search (command palette pattern)
- Auto-reconnect with exponential backoff
- Workspace color coding for visual distinction
- Connection health metrics (latency, stability)
- Activity notifications (unread indicators)
- Context preview on hover

**Key features from FEATURES.md:**
- Quick switcher with fuzzy search (competitive)
- Auto-reconnect (competitive)
- Workspace color coding (competitive)
- Connection health metrics (competitive)
- Activity notifications (competitive)
- Context preview on hover (competitive)

**Research flag:** **Needs phase research** for fuzzy search algorithm (Fuse.js vs native), auto-reconnect retry strategies (exponential backoff parameters), and connection health monitoring implementation (latency measurement techniques).

### Phase 4: Advanced Capabilities (v2+)
**Rationale:** Defer high-complexity features until product-market fit is established and usage data justifies investment. Parallel windows and offline-first require significant architectural work and resource isolation.

**Delivers:**
- Parallel workspace windows (2-3 simultaneous)
- Offline-first with sync queue
- Workspace groups/folders (50+ workspace scale)
- Context-aware AI workspace suggestions
- Workspace-specific keyboard shortcuts

**Key features from FEATURES.md:**
- Parallel workspace windows (deferred)
- Offline-first with sync queue (deferred)
- Workspace groups (deferred)
- AI suggestions (deferred)
- Workspace-specific shortcuts (deferred)

**Research flag:** **Needs phase research** for parallel windows (resource isolation techniques, Chromium multi-process architecture), offline-first (conflict resolution strategies, operational transformation patterns), and AI suggestions (pattern recognition approaches, feature engineering for workspace switching).

### Phase Ordering Rationale

**Why Phase 1 before UI:**
- Memory leaks discovered in production are expensive to fix and damage user trust
- Stale closures cause subtle bugs that only appear after repeated switches (hard to debug)
- IPC race conditions lead to data corruption if not prevented architecturally
- ServiceContextRegistry is foundational—all subsequent phases depend on it

**Why Phase 2 focused on table stakes:**
- Users will abandon app if basic switching doesn't work smoothly
- Visual workspace list, status indicators, and error handling are MVP requirements
- Keyboard shortcuts are expected by power users (primary demographic)
- State preservation makes or breaks the UX—users switching contexts expect zero data loss

**Why Phase 3 deferred until validation:**
- Fuzzy search only matters at 10+ workspaces (analytics will show when threshold hits)
- Auto-reconnect can be implemented after observing real-world network patterns
- Color coding is nice-to-have, not essential for functionality
- Connection health metrics require telemetry infrastructure

**Why Phase 4 is v2+:**
- Parallel windows require Chromium multi-process expertise (HIGH complexity)
- Offline-first needs conflict resolution (HIGH complexity, many edge cases)
- Workspace groups only needed at significant scale (50+ workspaces)
- AI suggestions require ML infrastructure and training data

**Dependency chain:**
```
ServiceContextRegistry → IPC Context API → StateSnapshot → ContextSwitcher UI
         ↓
   Service disposal → Listener cleanup → Timer cleanup
         ↓
   Provider injection pattern → Stale closure prevention
         ↓
   Context ID stamping → Race condition prevention
```

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 3** — Fuzzy search algorithm selection, auto-reconnect retry strategies, connection health monitoring
- **Phase 4** — Parallel window resource isolation, offline-first conflict resolution, AI pattern recognition

**Phases with standard patterns (skip research-phase):**
- **Phase 1** — ServiceContextRegistry uses established DI patterns, Zustand persist is documented, EventEmitter cleanup is standard Node.js
- **Phase 2** — Workspace switcher UI follows VS Code/Slack patterns, status indicators use established conventions

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zustand persist middleware well-documented with official examples, BroadcastChannel used by VS Code Remote and Akiflow, ServiceContextRegistry pattern proven in Microsoft TSyringe and node-dependency-injection |
| Features | HIGH | Feature baseline verified across 6 major applications (VS Code, JetBrains, Slack, Notion, Discord, Figma) with consistent patterns, table stakes vs differentiators clearly delineated |
| Architecture | MEDIUM | ServiceContextRegistry pattern is sound and used in production systems, but no direct examples of multi-workspace Electron apps using this exact combination (Zustand + ServiceContext + BroadcastChannel). Low risk—components individually proven. |
| Pitfalls | HIGH | All 8 pitfalls documented with real-world examples (Electron GitHub issues, production bug reports), prevention strategies verified through official docs and battle-tested patterns |

**Overall confidence:** HIGH

### Gaps to Address

**Architecture validation:** No reference implementation combining Zustand persist + ServiceContextRegistry + BroadcastChannel for Electron multi-context switching. Each component individually proven, but integration is novel.
- **Handle during planning:** Build small proof-of-concept in Phase 1 (10-file mini-app) to validate integration before full implementation
- **Validation criteria:** Prove context switch completes in <100ms, no memory leaks after 50 switches, multi-window sync works

**IndexedDB snapshot expiration strategy:** Research provides 5-minute TTL heuristic, but optimal value depends on actual data refresh latency and user switching patterns.
- **Handle during planning:** Start with 5-minute TTL, add telemetry in Phase 2 to track snapshot age at restoration, adjust based on p95 latency
- **Validation criteria:** <5% of switches trigger full re-fetch (snapshot expired), user doesn't perceive staleness

**Parallel window resource limits:** Phase 4 defers parallel windows, but no research on optimal limit (2 windows? 5? 10?).
- **Handle during execution:** When implementing Phase 4, research Chromium per-process memory overhead, test with 2/3/5/10 windows, establish limit based on 8GB RAM baseline
- **Validation criteria:** Memory usage stays under 500MB per window, no UI jank with N windows open

**Auto-reconnect backoff parameters:** Research mentions exponential backoff and max 6-10 retries, but no specifics on initial delay or multiplier.
- **Handle during Phase 3 planning:** Research PubNub connection management docs (cited in PITFALLS.md sources), test with 1s initial, 2x multiplier, 10s max to match SSH timeout patterns
- **Validation criteria:** 90%+ of transient network blips recover within 30s, users rarely see manual reconnect prompt

## Sources

### Primary (HIGH confidence)
- [Electron Official Documentation](https://www.electronjs.org/docs/latest/) — IPC patterns, process model, security best practices
- [Zustand Persist Middleware](https://zustand.docs.pmnd.rs/middlewares/persist) — Hydration control, partialize, storage backends
- [VS Code Remote Development](https://code.visualstudio.com/docs/remote/remote-overview) — Context switching patterns, extension classification, workspace indexing
- [Slack Workspace Switching](https://slack.com/help/articles/1500002200741-Switch-between-workspaces) — Multi-workspace UX patterns, keyboard shortcuts
- [JetBrains Gateway](https://www.jetbrains.com/remote-development/gateway/) — Workspace lifecycle, IDE backend management
- [Akiflow Multi-Window Messaging](https://akiflow.com/blog/multi-window-messaging-in-akiflow) — BroadcastChannel implementation patterns

### Secondary (MEDIUM confidence)
- [Advanced Electron.js Architecture - LogRocket](https://blog.logrocket.com/advanced-electron-js-architecture/) — Main process architecture, IPC best practices
- [Syncing State Between Electron Contexts - Bruno Scheufler](https://brunoscheufler.com/blog/2023-10-29-syncing-state-between-electron-contexts) — State synchronization patterns
- [React Stale Closures - Dmitri Pavlutin](https://dmitripavlutin.com/react-hooks-stale-closures/) — Stale closure prevention in React/Zustand
- [Diagnosing Memory Leaks in Electron - Mindful Chase](https://www.mindfulchase.com/explore/troubleshooting-tips/frameworks-and-libraries/diagnosing-and-fixing-memory-leaks-in-electron-applications.html) — EventEmitter leak patterns

### Tertiary (LOW confidence)
- [TSyringe - Microsoft DI Container](https://github.com/microsoft/tsyringe) — Dependency injection patterns for ServiceContextRegistry (used as inspiration, not direct implementation)
- [Connection Management - PubNub](https://www.pubnub.com/docs/general/setup/connection-management) — Auto-reconnect strategies (provides parameters for Phase 3)

---
*Research completed: 2026-02-12*
*Ready for roadmap: yes*
