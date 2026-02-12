# Technology Stack: Multi-Context Workspace Management

**Domain:** Electron desktop app with SSH remote + local context switching
**Researched:** 2026-02-12
**Confidence:** HIGH

## Recommended Stack

### Core State Management Pattern

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Zustand persist middleware** | 4.x | State snapshot/restoration | Built-in hydration control (`skipHydration`, `rehydrate`), selective persistence via `partialize`, storage backend abstraction. Already in use. |
| **Context isolation per workspace** | Pattern | Independent workspace state | Each workspace (local + N SSH hosts) gets own Zustand store instance, snapshotted to storage, restored on context switch. |
| **Broadcast Channel API** | Native | Multi-window state sync | Native browser API for same-origin window messaging. VS Code Remote and Akiflow use this. Zero dependencies, straightforward implementation. |
| **Workspace registry in main process** | Pattern | Service lifecycle management | Main process owns workspace registry mapping `contextId → { store snapshot, service instances, connection state }`. IPC triggers context switches. |

### IPC Architecture

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **ipcMain.handle / ipcRenderer.invoke** | Electron 28.x+ | Request/response IPC | Official Electron recommendation for async two-way IPC. Already in use. Type-safe with preload bridge. |
| **Workspace-scoped IPC channels** | Pattern | Context-aware requests | Prefix channels with contextId: `workspace:${contextId}:getSessions`. Main process routes to correct service instance. |
| **EventEmitter for status broadcasts** | Node.js native | Connection state events | Already used by SshConnectionManager. Extend pattern for workspace lifecycle events. |

### State Persistence

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Zustand persist → localStorage** | 4.x | Active workspace state | Fast synchronous access. Already configured. Each workspace gets namespaced key: `claude-devtools-workspace-${contextId}`. |
| **Zustand persist → IndexedDB** | 4.x (via idb-keyval) | Inactive workspace snapshots | Async storage for multiple workspace snapshots without localStorage quota limits. Zustand persist middleware supports custom storage backends. |
| **partialize for selective persistence** | Zustand built-in | Minimize storage overhead | Persist only domain data (projects, sessions, tabs), exclude transient UI state (loading flags, scroll positions). |

### Service Registry Pattern (Main Process)

| Component | Purpose | Implementation |
|-----------|---------|----------------|
| **WorkspaceRegistry** | Owns all workspace instances | `Map<contextId, WorkspaceContext>` where `WorkspaceContext = { provider: FileSystemProvider, services: ServiceInstances, lastAccessed: timestamp }` |
| **ServiceInstances** | Per-workspace service lifecycle | Each workspace gets own instances of ProjectScanner, SessionParser, FileWatcher, etc. Services use workspace-specific FileSystemProvider. |
| **Active workspace tracking** | Single active context at a time | `activeContextId: string`. IPC handlers route to `registry.get(activeContextId).services`. |
| **Lazy initialization** | Services created on first use | Registry initializes workspace services on connect (SSH) or app launch (local). Disposes inactive workspaces after TTL (e.g., 30min). |

### Context Switching Flow

| Phase | Mechanism | Rationale |
|-------|-----------|-----------|
| **1. Save current state** | `zustand.getState()` → IndexedDB | Snapshot entire store before switch. Non-blocking async operation. |
| **2. Broadcast workspace change** | `new BroadcastChannel('workspace-switch').postMessage({ contextId })` | Notify all renderer windows to update their UI for new context. |
| **3. Switch main process context** | `WorkspaceRegistry.setActive(contextId)` | Atomic switch of active FileSystemProvider + service instances. |
| **4. Restore target state** | IndexedDB → `zustand.setState()` | Hydrate store from snapshot. If no snapshot (new workspace), use empty initial state. |
| **5. Re-fetch live data** | `fetchProjects()`, `fetchRepositoryGroups()` | Refresh data from new context's file system. Already implemented in connectionSlice. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Zutron library** | Designed for syncing single store across main+renderer. We need multiple independent workspace stores. Adds unnecessary abstraction. | Direct Zustand persist + IPC for workspace switching. |
| **Redux/Redux Toolkit** | Overkill for context switching. Boilerplate-heavy. Zustand already in use and handles this elegantly with persist middleware. | Zustand with workspace-scoped stores. |
| **Global store with workspace slice** | Single store with `workspaces: { [id]: WorkspaceState }` scales poorly with large states, makes persistence complex, increases re-render surface. | Separate Zustand store instance per workspace. |
| **SharedWorker for multi-window** | More complex than BroadcastChannel, requires separate worker script, no tangible benefit for workspace switching use case. | BroadcastChannel API. |
| **Electron IPC for multi-window sync** | Round-trip through main process for window-to-window messaging is slower and more complex than BroadcastChannel. | BroadcastChannel for renderer-to-renderer, IPC for renderer-to-main. |

## Stack Patterns by Variant

### Pattern 1: Workspace Store Initialization

**When:** User switches to a workspace (SSH connect or local mode)

**Implementation:**
```typescript
// Renderer: Create workspace-scoped store
const createWorkspaceStore = (contextId: string) => {
  return create<AppState>()(
    persist(
      (...args) => ({
        ...createProjectSlice(...args),
        ...createSessionSlice(...args),
        // ... other slices
      }),
      {
        name: `claude-devtools-workspace-${contextId}`,
        storage: createJSONStorage(() => indexedDBStorage), // For inactive
        partialize: (state) => ({
          // Only persist domain data, not UI state
          projects: state.projects,
          sessions: state.sessions,
          tabs: state.tabs,
          // Exclude: loading, error, selectedIds
        }),
        skipHydration: true, // Manual hydration control
      }
    )
  );
};

// After switch, manually rehydrate
await store.persist.rehydrate();
```

**Why:**
- `skipHydration: true` prevents auto-load on store creation, gives control over when to restore state
- `partialize` minimizes storage size, excludes transient state that shouldn't survive context switch
- IndexedDB storage for inactive workspaces avoids localStorage 5MB quota issues

### Pattern 2: Main Process Service Registry

**When:** Routing IPC calls to workspace-specific services

**Implementation:**
```typescript
// Main process
class WorkspaceRegistry {
  private workspaces = new Map<string, WorkspaceContext>();
  private activeContextId: string = 'local';

  async initializeWorkspace(contextId: string, provider: FileSystemProvider) {
    const context: WorkspaceContext = {
      provider,
      services: {
        projectScanner: new ProjectScanner(provider),
        sessionParser: new SessionParser(provider),
        fileWatcher: new FileWatcher(provider),
        // ... other services
      },
      lastAccessed: Date.now(),
    };
    this.workspaces.set(contextId, context);
  }

  getActiveServices(): ServiceInstances {
    const context = this.workspaces.get(this.activeContextId);
    if (!context) throw new Error('No active workspace');
    return context.services;
  }

  setActive(contextId: string) {
    this.activeContextId = contextId;
  }
}

// IPC handler uses active workspace
ipcMain.handle('getProjects', async () => {
  const services = workspaceRegistry.getActiveServices();
  return services.projectScanner.scan();
});
```

**Why:**
- Services use FileSystemProvider interface → same code works for local + SSH
- Main process owns service lifecycle → renderer just calls IPC, doesn't manage connections
- Active workspace pattern → single source of truth for which context is current

### Pattern 3: Context Switch with State Preservation

**When:** User clicks "Switch to SSH" or "Switch to Local"

**Implementation:**
```typescript
// Renderer
async function switchWorkspace(newContextId: string) {
  const currentStore = useStore.getState();

  // 1. Save current workspace state to IndexedDB
  const currentSnapshot = currentStore;
  await saveWorkspaceSnapshot(currentContextId, currentSnapshot);

  // 2. Broadcast switch event to other windows
  const channel = new BroadcastChannel('workspace-switch');
  channel.postMessage({ contextId: newContextId });

  // 3. Tell main process to switch active context
  await window.electronAPI.workspace.setActive(newContextId);

  // 4. Restore target workspace state from IndexedDB
  const targetSnapshot = await loadWorkspaceSnapshot(newContextId);
  if (targetSnapshot) {
    useStore.setState(targetSnapshot);
  } else {
    // New workspace: reset to initial state
    useStore.setState(getInitialState());
  }

  // 5. Re-fetch live data from new context
  await currentStore.fetchProjects();
  await currentStore.fetchRepositoryGroups();
}
```

**Why:**
- State snapshot before switch → instant restoration when switching back
- BroadcastChannel → multi-window apps stay in sync
- Main process switch → IPC handlers route to correct services
- Re-fetch after restore → fresh data from new filesystem

### Pattern 4: Multi-Window Sync with BroadcastChannel

**When:** User has multiple app windows open, switches workspace in one window

**Implementation:**
```typescript
// Each renderer window listens
const channel = new BroadcastChannel('workspace-switch');
channel.onmessage = async (event) => {
  const { contextId } = event.data;

  // Don't process if this window initiated the switch
  if (contextId === currentContextId) return;

  // Update this window's state to match
  await switchWorkspace(contextId);
};

// Send when switching
channel.postMessage({ contextId: newContextId });
```

**Why:**
- Native API, no library needed
- Same-origin by default → secure
- Simpler than IPC round-trip for window-to-window messaging
- VS Code Remote and Akiflow use this pattern

## Installation

### Core Dependencies (Already Installed)
```bash
# Already in package.json
zustand@4.x
electron@28.x
ssh2@latest  # For SSH connections
```

### Additional Dependencies
```bash
# For IndexedDB storage backend
pnpm install idb-keyval

# No other dependencies needed - BroadcastChannel is native
```

## Architecture Best Practices

### Memory Management
- **Dispose inactive workspaces**: After 30min of inactivity, dispose service instances and FileSystemProvider. Keep snapshot in IndexedDB for instant restoration.
- **Limit snapshot count**: Keep max 5 workspace snapshots in IndexedDB. LRU eviction by `lastAccessed` timestamp.
- **Clear transient state on switch**: Don't persist loading flags, error messages, scroll positions → they're meaningless in restored context.

### Error Handling
- **Connection errors**: If SSH disconnects mid-session, auto-switch to local mode, preserve SSH workspace snapshot for reconnect.
- **Storage quota**: IndexedDB quota errors → warn user, fall back to localStorage for active workspace only, disable snapshot restoration.
- **Service initialization failures**: If workspace service init fails (e.g., remote path doesn't exist), show error banner but don't crash app. Allow manual retry.

### Performance Optimization
- **Debounced persistence**: Don't save snapshot on every state change. Debounce by 2-5 seconds, trigger on workspace blur.
- **Lazy service initialization**: Don't create all services on workspace init. Create ProjectScanner immediately, defer SessionParser until first session view.
- **Partial state updates**: When re-fetching after context switch, use `refreshSessionsInPlace` pattern (already implemented) to avoid flickering.

## TypeScript Patterns

### Workspace Context Type
```typescript
type WorkspaceContextId = `local` | `ssh-${string}`;

interface WorkspaceContext {
  id: WorkspaceContextId;
  provider: FileSystemProvider;
  services: ServiceInstances;
  lastAccessed: number;
  connectionInfo?: {
    host: string;
    port: number;
    username: string;
  };
}

interface ServiceInstances {
  projectScanner: ProjectScanner;
  sessionParser: SessionParser;
  fileWatcher: FileWatcher;
  // ... other services
}
```

### Storage Backend Interface
```typescript
interface WorkspaceStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

// IndexedDB implementation
const indexedDBStorage: WorkspaceStorage = {
  getItem: async (key) => {
    const value = await idbKeyval.get(key);
    return value ?? null;
  },
  setItem: async (key, value) => {
    await idbKeyval.set(key, value);
  },
  removeItem: async (key) => {
    await idbKeyval.del(key);
  },
};
```

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| zustand | 4.x | persist middleware 4.x | Persist middleware ships with zustand 4.x, no separate install |
| electron | 28.x+ | BroadcastChannel native | BroadcastChannel available in Chromium 54+ (Electron 1.x+) |
| idb-keyval | 6.x | TypeScript 5.x | Simple IndexedDB wrapper, 600 bytes minified |
| ssh2 | Latest | Node.js 18+ | Already in use for SSH connections |

## Confidence Levels

| Area | Confidence | Rationale |
|------|------------|-----------|
| **Zustand persist for state snapshotting** | HIGH | Official Zustand middleware, documented patterns for selective persistence and hydration control. Production-proven. |
| **BroadcastChannel for multi-window** | HIGH | Native browser API, used by VS Code Remote, Akiflow, and other Electron apps. Well-documented, zero dependencies. |
| **Service registry in main process** | HIGH | Standard Electron pattern for managing per-context resources. FileSystemProvider interface already supports this (SshFileSystemProvider vs LocalFileSystemProvider). |
| **IndexedDB for inactive snapshots** | MEDIUM | Zustand persist supports custom storage, idb-keyval is battle-tested, but no direct examples of multi-workspace Electron apps using this exact pattern. Low risk. |
| **Workspace TTL and eviction** | MEDIUM | Pattern is sound, but optimal TTL (30min) and max snapshots (5) are heuristics. May need tuning based on real-world usage. |

## Sources

### State Management
- [React State Management in 2025: Zustand vs. Redux vs. Jotai vs. Context](https://www.meerako.com/blogs/react-state-management-zustand-vs-redux-vs-context-2025)
- [React State Management 2025: Redux,Context, Recoil & Zustand](https://www.zignuts.com/blog/react-state-management-2025)
- [Zustand persist middleware documentation](https://zustand.docs.pmnd.rs/middlewares/persist)
- [Zustand persist - partialize option discussion](https://github.com/pmndrs/zustand/discussions/1273)

### Electron Multi-Window & IPC
- [Multiple Windows in Electron apps (2025)](https://blog.bloomca.me/2025/07/21/multi-window-in-electron.html)
- [Creating multi-window Electron apps using React portals](https://pietrasiak.com/creating-multi-window-electron-apps-using-react-portals)
- [Advanced Electron.js architecture - LogRocket Blog](https://blog.logrocket.com/advanced-electron-js-architecture/)
- [Electron IPC documentation](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Electron – 3 Methods for Inter Process Communications (IPC)](https://www.intertech.com/electron-3-methods-for-inter-process-communications-ipc/)

### BroadcastChannel Pattern
- [Multi-Window Messaging In Akiflow](https://akiflow.com/blog/multi-window-messaging-in-akiflow)
- [Creating a synchronized store between main and renderer process in Electron](https://www.bigbinary.com/blog/sync-store-main-renderer-electron)
- [BroadcastChannel API - 12 Days of Web](https://12daysofweb.dev/2024/broadcastchannel-api/)

### VS Code Architecture
- [Supporting Remote Development and GitHub Codespaces | Visual Studio Code Extension API](https://code.visualstudio.com/api/advanced-topics/remote-extensions)
- [VS Code 1.107 (November 2025 Update) Expands Multi-Agent Orchestration](https://visualstudiomagazine.com/articles/2025/12/12/vs-code-1-107-november-2025-update-expands-multi-agent-orchestration-model-management.aspx)
- [Behind the feature: building multi-account | Figma Blog](https://www.figma.com/blog/behind-the-feature-building-multi-account/)

### Electron State Management Libraries
- [Zutron: Streamlined Electron State Management](https://github.com/goosewobbler/zutron)
- [Syncing State between Electron Contexts - Bruno Scheufler](https://brunoscheufler.com/blog/2023-10-29-syncing-state-between-electron-contexts)

---
*Stack research for: Multi-context workspace management in Electron + Zustand*
*Researched: 2026-02-12*
