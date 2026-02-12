# Architecture Research: Multi-Context Workspace System

**Domain:** Electron application with multi-context workspace switching
**Researched:** 2026-02-12
**Confidence:** MEDIUM

## Standard Architecture

### System Overview

```
┌───────────────────────────────────────────────────────────────────────┐
│                         Main Process (Node.js)                         │
├───────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │              ServiceContextRegistry (NEW)                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │   │
│  │  │ LocalContext │  │  SshContext  │  │  SshContext  │        │   │
│  │  │  (always)    │  │   (Host A)   │  │   (Host B)   │        │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │   │
│  │         │                  │                  │                │   │
│  │    ┌────▼──────────────────▼──────────────────▼───────┐       │   │
│  │    │         Services (per context)                   │       │   │
│  │    │  - ProjectScanner                                │       │   │
│  │    │  - SessionParser                                 │       │   │
│  │    │  - SubagentResolver                              │       │   │
│  │    │  - ChunkBuilder (shared)                         │       │   │
│  │    │  - DataCache (per context)                       │       │   │
│  │    │  - FileWatcher (per context)                     │       │   │
│  │    └──────────────────────────────────────────────────┘       │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                  │                                     │
│  ┌───────────────────────────────▼───────────────────────────────┐   │
│  │              IPC Bridge (via preload)                          │   │
│  │  - getCurrentContext()                                         │   │
│  │  - switchContext(contextId)                                    │   │
│  │  - getContextSnapshot(contextId)                               │   │
│  │  - listContexts()                                              │   │
│  └────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────┬────────────────────────────────────┘
                                   │ IPC
┌──────────────────────────────────▼────────────────────────────────────┐
│                      Renderer Process (Chromium)                       │
├───────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │              ContextSwitcher (NEW)                             │   │
│  │  - Manages active context ID                                   │   │
│  │  - Coordinates switch flow                                     │   │
│  │  - Updates connection slice                                    │   │
│  └───────────────────────────────┬────────────────────────────────┘   │
│                                  │                                     │
│  ┌───────────────────────────────▼────────────────────────────────┐   │
│  │          Zustand Store (with snapshots)                        │   │
│  │                                                                 │   │
│  │  ┌────────────────────────────────────────────────────────┐    │   │
│  │  │ Current State (active context)                         │    │   │
│  │  │  - projects, sessions, selectedProjectId, etc.        │    │   │
│  │  └────────────────────────────────────────────────────────┘    │   │
│  │                                                                 │   │
│  │  ┌────────────────────────────────────────────────────────┐    │   │
│  │  │ contextSnapshots: Map<contextId, StateSnapshot>       │    │   │
│  │  │  - Stores full state per context for instant restore  │    │   │
│  │  └────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                  │                                     │
│  ┌───────────────────────────────▼────────────────────────────────┐   │
│  │          React Components                                       │   │
│  │  - ContextSwitcher UI (dropdown/sidebar)                       │   │
│  │  - Dashboard (context-aware)                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **ServiceContextRegistry** | Manages multiple service contexts (local + N SSH), lifecycle, and active context switching | Map of contextId → ServiceContext objects, provides getActive(), switch(), register() |
| **ServiceContext** | Encapsulates service instances and FileSystemProvider for one context | Holds ProjectScanner, SessionParser, SubagentResolver, DataCache, FileWatcher, fsProvider |
| **ContextSwitcher** (renderer) | Orchestrates context switches from renderer side, manages UI state | Calls IPC to switch, captures/restores snapshots, updates Zustand |
| **StateSnapshot** | Frozen copy of renderer state for a context | Full or partial state (projects, sessions, selections, UI state) |
| **IPC Context Handlers** | Exposes context management to renderer | getCurrentContext, switchContext, getContextSnapshot, listContexts |

## Recommended Project Structure

```
src/
├── main/
│   ├── services/
│   │   ├── infrastructure/
│   │   │   ├── ServiceContext.ts          # NEW: Encapsulates services for one context
│   │   │   ├── ServiceContextRegistry.ts  # NEW: Manages all contexts
│   │   │   └── ContextLifecycleManager.ts # NEW: Start/stop context services
│   │   └── ... (existing services)
│   ├── ipc/
│   │   └── context.ts                     # NEW: Context switching IPC handlers
│   └── index.ts                            # Modified: Initialize registry
├── renderer/
│   ├── store/
│   │   ├── slices/
│   │   │   ├── contextSlice.ts            # NEW: Context management state
│   │   │   └── connectionSlice.ts         # Modified: Works with contextSlice
│   │   └── utils/
│   │       └── stateSnapshot.ts           # NEW: Snapshot capture/restore
│   ├── components/
│   │   └── common/
│   │       └── ContextSwitcher.tsx        # NEW: Context switcher UI
│   └── hooks/
│       └── useContextSwitch.ts            # NEW: Hook for switching contexts
└── shared/
    └── types/
        └── context.ts                      # NEW: Context-related types
```

### Structure Rationale

- **ServiceContextRegistry** in infrastructure: Central registry pattern, manages context lifecycle
- **ServiceContext** wraps all service instances: Clean isolation boundary, easy to create/destroy
- **ContextSlice** separate from connectionSlice: Context is broader than SSH (could add Docker, WSL, etc. later)
- **State snapshots** in store utils: Serialize/deserialize state for instant restore
- **IPC context handlers** in dedicated file: Clear separation of concerns from existing SSH handlers

## Architectural Patterns

### Pattern 1: Service Context Registry

**What:** Central registry that manages multiple isolated service contexts, each with its own FileSystemProvider and service instances.

**When to use:** When you need to support multiple data sources (local, SSH hosts, containers) without tearing down/recreating all services on every switch.

**Trade-offs:**
- **Pros:**
  - Local context stays alive (critical for notifications, config)
  - Instant switching between known contexts
  - Clear isolation boundaries
  - Easy to add new context types (Docker, WSL, etc.)
- **Cons:**
  - Memory overhead (multiple service sets in memory)
  - Complexity of managing context lifecycle
  - Need to handle cross-context data requests carefully

**Example:**
```typescript
// ServiceContext.ts
export interface ServiceContext {
  id: string;
  type: 'local' | 'ssh';
  label: string; // "Local" or "user@hostname"

  // Service instances
  projectScanner: ProjectScanner;
  sessionParser: SessionParser;
  subagentResolver: SubagentResolver;
  dataCache: DataCache;
  fileWatcher: FileWatcher;

  // Provider
  fsProvider: FileSystemProvider;

  // Lifecycle
  isActive: boolean;
  createdAt: Date;
  lastAccessedAt: Date;
}

// ServiceContextRegistry.ts
export class ServiceContextRegistry {
  private contexts = new Map<string, ServiceContext>();
  private activeContextId: string = 'local';

  constructor() {
    // Always initialize local context
    this.registerLocalContext();
  }

  register(context: ServiceContext): void {
    this.contexts.set(context.id, context);
  }

  getActive(): ServiceContext {
    return this.contexts.get(this.activeContextId)!;
  }

  async switch(contextId: string): Promise<ServiceContext> {
    const context = this.contexts.get(contextId);
    if (!context) throw new Error(`Context ${contextId} not found`);

    // Pause current context's watchers
    const current = this.getActive();
    current.fileWatcher.stop();
    current.isActive = false;

    // Activate new context
    context.isActive = true;
    context.lastAccessedAt = new Date();
    context.fileWatcher.start();
    this.activeContextId = contextId;

    return context;
  }

  list(): ServiceContext[] {
    return Array.from(this.contexts.values());
  }

  async createSshContext(
    host: string,
    sshManager: SshConnectionManager
  ): Promise<ServiceContext> {
    // Create services with SSH provider
    const provider = sshManager.getProvider();
    const projectsDir = sshManager.getRemoteProjectsPath()!;

    const context: ServiceContext = {
      id: `ssh:${host}`,
      type: 'ssh',
      label: host,
      projectScanner: new ProjectScanner(projectsDir, undefined, provider),
      sessionParser: new SessionParser(/* ... */),
      subagentResolver: new SubagentResolver(/* ... */),
      dataCache: new DataCache(MAX_CACHE_SESSIONS, CACHE_TTL_MINUTES),
      fileWatcher: new FileWatcher(/* ... */),
      fsProvider: provider,
      isActive: false,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
    };

    this.register(context);
    return context;
  }
}
```

### Pattern 2: State Snapshot with Instant Restore

**What:** Capture full renderer state for each context and restore it instantly on switch, avoiding re-fetching from main process.

**When to use:** When you need instant (<50ms) context switching and want to preserve user's navigation/selection state per context.

**Trade-offs:**
- **Pros:**
  - Instant perceived switching (no loading states)
  - Preserves user's place in each context (selected project, open tabs, scroll position)
  - Reduces IPC round-trips
- **Cons:**
  - Memory overhead in renderer (full state × N contexts)
  - Snapshot can become stale (need expiration/refresh strategy)
  - Need to handle snapshot compatibility across app versions

**Example:**
```typescript
// stateSnapshot.ts
export interface StateSnapshot {
  contextId: string;
  capturedAt: Date;
  expiresAt: Date; // Auto-refresh if older than 5 minutes

  // Core data
  projects: Project[];
  sessions: Session[];
  repositoryGroups: RepositoryGroup[];

  // Selections
  selectedProjectId: string | null;
  selectedSessionId: string | null;

  // UI state
  tabs: Tab[];
  activeTabId: string | null;
  paneLayout: PaneLayout;

  // Metadata
  version: string; // App version for compatibility check
}

export function captureSnapshot(state: AppState, contextId: string): StateSnapshot {
  return {
    contextId,
    capturedAt: new Date(),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min
    projects: state.projects,
    sessions: state.sessions,
    repositoryGroups: state.repositoryGroups,
    selectedProjectId: state.selectedProjectId,
    selectedSessionId: state.selectedSessionId,
    tabs: state.tabs,
    activeTabId: state.activeTabId,
    paneLayout: state.paneLayout,
    version: state.appVersion,
  };
}

export function restoreSnapshot(snapshot: StateSnapshot): Partial<AppState> {
  // Check if snapshot is stale
  if (new Date() > snapshot.expiresAt) {
    // Return only UI state, let data re-fetch
    return {
      tabs: snapshot.tabs,
      activeTabId: snapshot.activeTabId,
      paneLayout: snapshot.paneLayout,
    };
  }

  // Restore full state
  return {
    projects: snapshot.projects,
    sessions: snapshot.sessions,
    repositoryGroups: snapshot.repositoryGroups,
    selectedProjectId: snapshot.selectedProjectId,
    selectedSessionId: snapshot.selectedSessionId,
    tabs: snapshot.tabs,
    activeTabId: snapshot.activeTabId,
    paneLayout: snapshot.paneLayout,
  };
}
```

### Pattern 3: IPC Handler Re-Routing

**What:** IPC handlers always query the active context from registry instead of using module-level service variables.

**When to use:** When you need IPC handlers to automatically target the active context without manual re-initialization on every switch.

**Trade-offs:**
- **Pros:**
  - No need for `reinitializeServiceHandlers()` on every switch
  - Handlers automatically use correct context
  - Less code to maintain
- **Cons:**
  - Need to pass registry to all handler initializers
  - Small performance cost (registry lookup on every IPC call)

**Example:**
```typescript
// ipc/projects.ts (modified)
let registry: ServiceContextRegistry;

export function initializeProjectHandlers(reg: ServiceContextRegistry): void {
  registry = reg;
}

export function registerProjectHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(GET_PROJECTS, async () => {
    try {
      // Always use active context
      const context = registry.getActive();
      const projects = await context.projectScanner.scan();
      return projects;
    } catch (err) {
      logger.error('Failed to get projects:', err);
      return [];
    }
  });
}
```

## Data Flow

### Context Switch Flow

```
User clicks context in UI
    ↓
[Renderer: ContextSwitcher]
    ↓ (1) Capture current state
[Renderer: captureSnapshot(currentContextId)]
    ↓ (2) Store in contextSnapshots map
[Renderer: contextSnapshots.set(currentContextId, snapshot)]
    ↓ (3) Call IPC to switch context
[IPC: switchContext(newContextId)]
    ↓ (4) Switch active context in registry
[Main: ServiceContextRegistry.switch(newContextId)]
    │
    ├── Stop current context's FileWatcher
    ├── Mark current context inactive
    ├── Activate new context
    └── Start new context's FileWatcher
    ↓ (5) Return new context metadata
[IPC Response: { contextId, type, label }]
    ↓ (6) Check for existing snapshot
[Renderer: contextSnapshots.get(newContextId)]
    │
    ├─── Snapshot exists? ──────────┐
    │                               │
    │                          (instant restore)
    │                               ↓
    │                    [restoreSnapshot(snapshot)]
    │                               ↓
    │                    [UI updates immediately]
    │
    └─── No snapshot? ──────────────┐
                                    │
                              (fetch fresh)
                                    ↓
                        [fetchProjects(), fetchRepositoryGroups()]
                                    ↓
                        [Show loading states]
                                    ↓
                        [UI updates when data arrives]
```

### Key Data Flows

1. **Context registration (SSH):** User connects → SshConnectionManager.connect() → ServiceContextRegistry.createSshContext() → Context registered
2. **Active context query:** IPC handler → registry.getActive() → ServiceContext → service.method()
3. **Context list update:** Registry change → main sends IPC event → renderer updates context list UI
4. **Snapshot refresh:** Context switch + stale snapshot → partial restore → background re-fetch → update snapshot

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-3 contexts | Simple Map-based registry, full state snapshots, no eviction |
| 4-10 contexts | Add LRU eviction (keep 3 most recent contexts), lazy service initialization |
| 10+ contexts | Move to connection pool pattern, on-demand context creation, aggressive cache eviction |

### Scaling Priorities

1. **First bottleneck:** Memory usage from multiple DataCache instances. **Fix:** Share ChunkBuilder, only keep DataCache per-context for active requests.
2. **Second bottleneck:** FileWatcher overhead. **Fix:** Only watch active context + local (for notifications). Pause watchers on inactive contexts.

## Anti-Patterns

### Anti-Pattern 1: Destroying Local Context on SSH Connect

**What people do:** Call `disconnect()` on local services when connecting to SSH, assuming exclusive mode.

**Why it's wrong:** Notifications, config updates, and local file watching should continue running even when viewing remote data. User may want to quickly check local sessions without full reconnect.

**Do this instead:** Keep local context always alive. Add it to registry at startup with id="local". SSH contexts are additive, not replacements.

### Anti-Pattern 2: Re-Initializing All Services on Every Switch

**What people do:** Call `initializeServices()` and `reinitializeServiceHandlers()` on every context switch, recreating everything.

**Why it's wrong:** Expensive (2-3 second delay), destroys caches, resets watchers, loses in-flight operations. Causes UI flicker and poor UX.

**Do this instead:** Use ServiceContextRegistry to maintain multiple contexts. Switch by updating `activeContextId` pointer. Services stay alive and warm.

### Anti-Pattern 3: Blocking UI on Context Switch

**What people do:** Show full-screen loading spinner, disable all controls, wait for all data to re-fetch before showing any UI.

**Why it's wrong:** Context switch feels slow (500ms+ perceived latency). User loses sense of continuity. Can't cancel or go back.

**Do this instead:** Use optimistic state snapshots. Restore snapshot immediately (<50ms), show UI instantly, refresh data in background. Show subtle loading indicators only for stale data.

### Anti-Pattern 4: Sharing DataCache Across Contexts

**What people do:** Use a single DataCache for all contexts, keyed by `${contextId}:${projectId}:${sessionId}`.

**Why it's wrong:** Cache keys collide if same project path exists on multiple hosts. Eviction strategy becomes complex. Memory usage unbounded.

**Do this instead:** Each ServiceContext has its own DataCache. When context becomes inactive, optionally clear its cache to free memory (LRU policy).

### Anti-Pattern 5: No Context Metadata in IPC Responses

**What people do:** IPC handlers return raw data (projects, sessions) without indicating which context it came from.

**Why it's wrong:** Renderer can't detect stale responses from previous context. If user switches quickly A→B→A, response from first A might arrive after B response, causing wrong data to display.

**Do this instead:** Every IPC response includes `contextId` field. Renderer checks if response matches current active context before applying to state. Discard stale responses.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| SshConnectionManager | Wrap in ServiceContext | Create ServiceContext after successful connect, register with registry |
| FileWatcher | Per-context instance | Only active context's watcher runs. Start/stop on switch. |
| NotificationManager | Singleton, local only | Always uses local FileSystemProvider. Notifications are local-only feature. |
| ConfigManager | Singleton, local only | Settings stored locally. Applies across all contexts. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Registry ↔ IPC Handlers | Direct method calls | Handlers call `registry.getActive().service.method()` |
| Main ↔ Renderer | IPC events + responses | Main sends `context-list-updated` event when contexts change |
| ServiceContext ↔ Services | Constructor injection | Pass fsProvider, projectsDir to service constructors |
| ContextSwitcher ↔ Store | Zustand actions | Call `switchContext(id)` action, store handles snapshot logic |

## Implementation Phases

### Phase 1: Main Process Architecture (Foundation)
**Goal:** Establish ServiceContext and ServiceContextRegistry

**Components to build:**
1. `ServiceContext.ts` - Interface and factory function
2. `ServiceContextRegistry.ts` - Registry with register/switch/getActive
3. Modify `index.ts` - Initialize registry instead of individual services
4. Update `ipc/handlers.ts` - Pass registry to all handlers

**Why first:** Main process architecture must be stable before renderer changes. This phase has no user-facing changes.

**Build order:** ServiceContext → ServiceContextRegistry → Modify index.ts → Update IPC handlers

### Phase 2: IPC Context API (Bridge)
**Goal:** Expose context operations to renderer

**Components to build:**
1. `ipc/context.ts` - Context IPC handlers (getCurrentContext, switchContext, listContexts)
2. `preload/index.ts` - Expose context API methods
3. Add IPC channel constants in `preload/constants/ipcChannels.ts`

**Why second:** Bridge must exist before renderer can consume it. Testable from Node.js before building UI.

**Build order:** IPC handlers → Preload API → Test with node REPL

### Phase 3: Renderer State Management (State)
**Goal:** Add context slice and snapshot system

**Components to build:**
1. `store/slices/contextSlice.ts` - Context state, actions, snapshot storage
2. `store/utils/stateSnapshot.ts` - Snapshot capture/restore functions
3. Modify `store/slices/connectionSlice.ts` - Delegate to contextSlice for SSH mode

**Why third:** State layer must exist before UI components can trigger switches.

**Build order:** stateSnapshot utils → contextSlice → Update connectionSlice → Test actions in console

### Phase 4: UI Integration (User-Facing)
**Goal:** Add context switcher UI

**Components to build:**
1. `components/common/ContextSwitcher.tsx` - Dropdown or sidebar UI
2. `hooks/useContextSwitch.ts` - Hook for switching with loading states
3. Update `Dashboard.tsx` - Show current context, integrate switcher

**Why last:** UI is the final layer. Depends on all previous phases.

**Build order:** useContextSwitch hook → ContextSwitcher UI → Integrate in Dashboard

## Build Dependencies

```
Phase 1 (Main)
    ↓ (ServiceContextRegistry needed by IPC)
Phase 2 (IPC Bridge)
    ↓ (IPC API needed by store)
Phase 3 (Renderer State)
    ↓ (Store actions needed by UI)
Phase 4 (UI)
```

**Critical path:** ServiceContext → ServiceContextRegistry → IPC context handlers → contextSlice → ContextSwitcher UI

**Parallelizable:**
- Phase 1 and Phase 3 (main vs renderer) can be worked on by different developers
- stateSnapshot utils can be built before contextSlice is finalized
- UI components can be mocked with fake data while state layer is being built

## Sources

**Architecture Patterns:**
- [Electron Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model) - Official Electron multi-process architecture
- [Electron Inter-Process Communication](https://www.electronjs.org/docs/latest/tutorial/ipc) - IPC patterns for context coordination
- [Advanced Electron.js architecture - LogRocket Blog](https://blog.logrocket.com/advanced-electron-js-architecture/) - Advanced patterns for Electron apps
- [Building Multi-Screen Electron Applications - CorticalFlow](https://corticalflow.com/en/blog/building-multi-screen-electron-apps) - Cognitive workflow optimization with multi-context apps

**State Management:**
- [Syncing State between Electron Contexts - Bruno Scheufler](https://brunoscheufler.com/blog/2023-10-29-syncing-state-between-electron-contexts) - State synchronization patterns
- [Zutron - GitHub](https://github.com/goosewobbler/zutron) - Zustand for Electron, main-renderer sync
- [Creating a synchronized store between main and renderer - BigBinary](https://www.bigbinary.com/blog/sync-store-main-renderer-electron) - Store sync techniques

**Service Registry & DI:**
- [tsyringe - GitHub](https://github.com/microsoft/tsyringe) - Microsoft's TypeScript DI container
- [node-dependency-injection - npm](https://www.npmjs.com/package/node-dependency-injection) - DI for Node.js
- [Dependency Injection in NodeJS TypeScript - Lodely](https://www.lodely.com/blog/dependency-injection-in-nodejs-typescript) - DI patterns for Node.js/TypeScript
- [Top 5 TypeScript dependency injection containers - LogRocket](https://blog.logrocket.com/top-five-typescript-dependency-injection-containers/) - Comparison of DI libraries

**Context Patterns:**
- [ServiceTalk Asynchronous Context](https://apple.github.io/servicetalk/servicetalk-concurrent-api/SNAPSHOT/async-context.html) - Context isolation in async systems
- [Provider Pattern with React Context API - Flexiple](https://flexiple.com/react/provider-pattern-with-react-context-api) - Provider patterns for context management

---
*Architecture research for: Multi-context workspace switching in claude-devtools*
*Researched: 2026-02-12*
