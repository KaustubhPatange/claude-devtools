# Requirements: SSH Multi-Context Workspaces

**Defined:** 2026-02-12
**Core Value:** Users can seamlessly switch between local and SSH workspaces without losing state, and SSH sessions actually load their conversation history.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Provider Plumbing

- [ ] **PROV-01**: SSH sessions display full conversation history (fix FileSystemProvider plumbing through SessionParser)
- [ ] **PROV-02**: SSH subagent drill-down loads correctly over SFTP (fix SubagentResolver and SubagentDetailBuilder provider plumbing)

### Service Context Management

- [ ] **SCTX-01**: ServiceContextRegistry manages local + N SSH service contexts with getActive/switch/create/destroy lifecycle
- [ ] **SCTX-02**: Local service context is always alive and never destroyed on SSH connect/disconnect
- [ ] **SCTX-03**: Each SSH context has independent services (ProjectScanner, SessionParser, SubagentResolver, ChunkBuilder, DataCache, FileWatcher)
- [ ] **SCTX-04**: All services implement dispose() for proper cleanup (EventEmitter listeners, timers, SSH connections)
- [ ] **SCTX-05**: IPC requests are stamped with context ID to prevent race conditions during rapid switching

### IPC Context API

- [ ] **IPC-01**: Context management IPC channels exist (context:list, context:switch, context:connect-ssh, context:disconnect-ssh, context:destroy)
- [ ] **IPC-02**: Preload exposes context API to renderer (window.electronAPI.context)
- [ ] **IPC-03**: File watcher events are scoped to active context only

### State Snapshot/Restore

- [ ] **SNAP-01**: Full Zustand state snapshot captured on context switch (projects, sessions, tabs, pane layout, selections, notifications)
- [ ] **SNAP-02**: Switching to a previously visited context restores exact state instantly (no refetch)
- [ ] **SNAP-03**: Switching to a never-visited context shows empty/skeleton state (not stale local data)
- [ ] **SNAP-04**: Loading overlay displayed during context switch to prevent stale data flash
- [ ] **SNAP-05**: Context snapshots persist to IndexedDB (survive app restart)

### Workspace UI

- [ ] **WSUI-01**: Context switcher dropdown in sidebar lists Local + connected SSH workspaces
- [ ] **WSUI-02**: Status bar indicator shows active workspace name and connection status
- [ ] **WSUI-03**: Connection status indicators display connected/connecting/disconnected/error states
- [ ] **WSUI-04**: SSH connection profiles can be saved, edited, and deleted in settings
- [ ] **WSUI-05**: Keyboard shortcuts available for switching between workspaces

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced UX

- **WSUI-06**: Color-coded workspace indicators per SSH connection
- **WSUI-07**: Fuzzy search in workspace switcher for quick filtering
- **WSUI-08**: Auto-reconnect with exponential backoff on SSH disconnect
- **WSUI-09**: Workspace health metrics (latency, connection uptime)

### Advanced Capabilities

- **ADV-01**: Parallel workspace windows (view two workspaces simultaneously)
- **ADV-02**: Cross-context session comparison (local vs remote side-by-side)
- **ADV-03**: Workspace groups (organize related SSH connections)

## Out of Scope

| Feature | Reason |
|---------|--------|
| SFTP performance optimization | Investigating separately after workspace switching works |
| SSH key management UI | Use system SSH keys, not app-managed |
| Multi-window side-by-side workspaces | v2+ complexity; current model is one-at-a-time switching |
| Mobile/responsive layout | Desktop-only app |
| BroadcastChannel multi-window sync | Single window for v1; multi-window is v2+ |
| Offline-first workspace caching | Would require conflict resolution strategy; defer |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROV-01 | Phase 1 | Pending |
| PROV-02 | Phase 1 | Pending |
| SCTX-01 | Phase 2 | Pending |
| SCTX-02 | Phase 2 | Pending |
| SCTX-03 | Phase 2 | Pending |
| SCTX-04 | Phase 2 | Pending |
| SCTX-05 | Phase 2 | Pending |
| IPC-01 | Phase 2 | Pending |
| IPC-02 | Phase 2 | Pending |
| IPC-03 | Phase 2 | Pending |
| SNAP-01 | Phase 3 | Pending |
| SNAP-02 | Phase 3 | Pending |
| SNAP-03 | Phase 3 | Pending |
| SNAP-04 | Phase 3 | Pending |
| SNAP-05 | Phase 3 | Pending |
| WSUI-01 | Phase 4 | Pending |
| WSUI-02 | Phase 4 | Pending |
| WSUI-03 | Phase 4 | Pending |
| WSUI-04 | Phase 4 | Pending |
| WSUI-05 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0

**Validation:**
- Phase 1: 2 requirements (PROV-01, PROV-02)
- Phase 2: 8 requirements (SCTX-01 through SCTX-05, IPC-01 through IPC-03)
- Phase 3: 5 requirements (SNAP-01 through SNAP-05)
- Phase 4: 5 requirements (WSUI-01 through WSUI-05)
- Total: 20 requirements mapped

---
*Requirements defined: 2026-02-12*
*Last updated: 2026-02-12 after roadmap creation (traceability complete)*
