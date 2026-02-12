# Architecture

**Analysis Date:** 2026-02-12

## Pattern Overview

**Overall:** Three-process Electron architecture with domain-driven service layer and unidirectional data flow

**Key Characteristics:**
- Electron main process (Node.js) handles file system access, JSONL parsing, and business logic via domain-organized services
- Renderer process (React) manages UI state through Zustand slices with per-tab isolation
- Preload script provides secure IPC bridge via contextBridge
- Data flows: JSONL files → Services (parse/analyze) → IPC → Zustand store → React components
- Service layer organized into 5 domains: analysis, discovery, error, infrastructure, parsing

## Layers

**Main Process (Node.js):**
- Purpose: File system access, session parsing, chunk building, business logic
- Location: `src/main/`
- Contains: Entry point (`index.ts`), services (domain-organized), IPC handlers, types, utilities
- Depends on: Electron APIs, Node.js file system, shared types
- Used by: Renderer process via IPC

**Preload Bridge:**
- Purpose: Secure IPC communication layer between main and renderer
- Location: `src/preload/`
- Contains: ElectronAPI implementation (`index.ts`), IPC channel constants
- Depends on: Electron contextBridge, IPC channel definitions
- Used by: Renderer process via `window.electronAPI`

**Renderer Process (React):**
- Purpose: UI rendering, state management, user interaction
- Location: `src/renderer/`
- Contains: React components, Zustand store, hooks, utilities, contexts
- Depends on: React, Zustand, ElectronAPI, shared types
- Used by: End user

**Shared Code:**
- Purpose: Cross-process types, pure utilities, constants
- Location: `src/shared/`
- Contains: Type definitions, token formatting, model parsing, logger
- Depends on: Nothing (pure TypeScript)
- Used by: Main, renderer, preload processes

**Service Domains (Main Process):**
- Purpose: Business logic organized by responsibility
- Location: `src/main/services/{domain}/`
- Contains: 5 domains with specialized services
- Depends on: Node.js APIs, shared types, utilities
- Used by: IPC handlers, main process lifecycle

## Data Flow

**Session Loading Flow:**

1. User selects project/session in sidebar (renderer)
2. Renderer calls `window.electronAPI.getSessionDetail(projectId, sessionId)`
3. IPC handler in `src/main/ipc/sessions.ts` receives request
4. Handler checks `DataCache` (LRU cache, 50 entries, 10min TTL)
5. On cache miss: `SessionParser` reads JSONL file from `~/.claude/projects/{encoded-path}/{sessionId}.jsonl`
6. `SessionParser` parses messages, extracts metadata, calculates metrics
7. `SubagentResolver` finds subagent files in `{sessionId}/subagents/`, parses them, links to Task calls
8. `ChunkBuilder` orchestrates chunk building: classifies messages (user/AI/system/noise), groups into chunks, attaches subagents
9. Result cached in `DataCache` and returned via IPC
10. Renderer receives data, updates Zustand store (`sessionDetailSlice`)
11. React components re-render with new data

**Real-time Update Flow:**

1. `FileWatcher` detects change in session JSONL file (100ms debounce)
2. FileWatcher emits 'file-change' event with `{ type, path, projectId, sessionId, isSubagent }`
3. Main process forwards event to renderer via `mainWindow.webContents.send('file-change', event)`
4. Renderer's `initializeNotificationListeners()` receives event
5. Store action `refreshSessionInPlace()` called (debounced 150ms)
6. Cache invalidated, session re-parsed
7. Store updated without changing `selectedSessionId` (no flicker)
8. Components re-render with updated data

**State Management:**
- Zustand store with 14 slices (project, session, sessionDetail, subagent, conversation, tab, tabUI, pane, ui, notification, config, repository, connection, update)
- Each slice follows pattern: `{ data, selectedId, loading, error }`
- Per-tab UI state isolated in `tabUISlice` using tabId as key
- IPC event listeners registered once in `App.tsx`, update store directly

## Key Abstractions

**Chunk (Visualization Unit):**
- Purpose: Independent timeline visualization unit for chat display
- Examples: `UserChunk`, `AIChunk`, `SystemChunk`, `CompactChunk`
- Pattern: Discriminated union on `type` field, each with timestamp, duration, metrics (tokens, cost, tools)
- Built by: `ChunkBuilder` orchestrating `ChunkFactory`, `MessageClassifier`, `ProcessLinker`

**Process (Subagent):**
- Purpose: Represents spawned subagent execution with timing and metrics
- Examples: Task tool subagents, teammate messages in team coordination
- Pattern: Contains `id`, `name`, `startTime`, `endTime`, `metrics`, `isParallel`, optional `team` metadata
- Built by: `SubagentResolver` parsing subagent JSONL files, linking to Task calls, detecting parallel execution

**Service (Business Logic):**
- Purpose: Domain-specific business logic with single responsibility
- Examples: `ChunkBuilder` (analysis), `ProjectScanner` (discovery), `SessionParser` (parsing), `NotificationManager` (infrastructure), `ErrorDetector` (error)
- Pattern: Class-based, injected dependencies via constructor, exported from domain barrel
- Location: `src/main/services/{domain}/`

**Zustand Slice (State Domain):**
- Purpose: Domain-specific state management with actions
- Examples: `sessionSlice`, `tabSlice`, `notificationSlice`
- Pattern: Factory function returning slice with data, actions, selectors
- Combined in: `src/renderer/store/index.ts` via `create<AppState>()`

**IPC Handler (Communication):**
- Purpose: Request/response handlers for renderer-to-main communication
- Examples: `get-projects`, `get-session-detail`, `notifications:get`
- Pattern: Domain-organized modules with initialize/register/remove functions
- Location: `src/main/ipc/{domain}.ts`

## Entry Points

**Main Process Entry:**
- Location: `src/main/index.ts` (381 lines)
- Triggers: `app.whenReady()` Electron event
- Responsibilities: Initialize services (ProjectScanner, SessionParser, SubagentResolver, ChunkBuilder, DataCache, FileWatcher, NotificationManager, UpdaterService, SshConnectionManager), register IPC handlers, create BrowserWindow, start file watcher, apply configuration

**Renderer Entry:**
- Location: `src/renderer/main.tsx` (12 lines)
- Triggers: Page load after Electron window created
- Responsibilities: Render React app (`<App />`), mount to #root div

**Preload Entry:**
- Location: `src/preload/index.ts` (369 lines)
- Triggers: Before renderer loads (Electron lifecycle)
- Responsibilities: Expose ElectronAPI via contextBridge, wrap IPC calls with type-safe interface, provide event listener setup/cleanup

**React App Component:**
- Location: `src/renderer/App.tsx`
- Triggers: React render
- Responsibilities: Initialize theme, dismiss splash screen, register IPC event listeners (`initializeNotificationListeners()`), render layout (`<TabbedLayout />`)

## Error Handling

**Strategy:** Layer-specific error boundaries with graceful degradation

**Patterns:**
- Main process: Try/catch in services and IPC handlers, log errors with `createLogger()`, return null or empty arrays on failure
- Renderer: React `<ErrorBoundary>` component catches render errors, shows fallback UI
- IPC: Config handlers return `{ success: boolean, data?, error? }` wrapper, other handlers return null on failure
- Store actions: Catch async errors, set `error` state, display in UI

## Cross-Cutting Concerns

**Logging:** `createLogger(namespace)` from `@shared/utils/logger`, used throughout main and renderer

**Validation:**
- Path validation in `src/main/ipc/validation.ts` via `validatePath()`, `validateMentions()`
- Config validation in `src/main/ipc/configValidation.ts` for user input sanitization
- Type guards in `src/main/ipc/guards.ts` for IPC argument validation

**Authentication:** Not applicable (local desktop app accessing user's file system)

**Caching:**
- `DataCache` service (LRU, 50 entries, 10min TTL) for parsed session data
- Cache invalidation on file changes detected by `FileWatcher`
- Automatic cleanup every 5 minutes

**Performance:**
- Virtual scrolling for session lists and message lists (`@tanstack/react-virtual`)
- Debounced file watching (100ms) to batch rapid changes
- Session refresh debouncing (150ms) to prevent redundant IPC calls
- LRU cache to avoid re-parsing large JSONL files

**Configuration:**
- `ConfigManager` service manages `~/.claude-devtools/config.json`
- Accessed via `configManager.getConfig()`, `configManager.updateConfig()`
- IPC handlers in `src/main/ipc/config.ts` for renderer access
- Settings UI in `src/renderer/components/settings/`

---

*Architecture analysis: 2026-02-12*
