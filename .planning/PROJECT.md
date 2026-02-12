# SSH Multi-Context Workspaces

## What This Is

A workspace-based multi-context system for claude-devtools that treats local and SSH connections as independent, switchable screens. Local mode is always alive. Each SSH connection is an independent workspace with its own projects, sessions, tabs, notifications, and state — freely switchable with instant state preservation. Like having multiple monitors you flip between.

## Core Value

Users can seamlessly switch between local and any number of SSH workspaces without losing state, and SSH sessions actually load their conversation history.

## Requirements

### Validated

- SSH connection establishment and SFTP file system provider — existing
- Session discovery over SSH (sidebar lists remote sessions) — existing
- SSH connection settings UI — existing
- SSH auto-reconnect and last-connection persistence — existing

### Active

- [ ] SSH sessions display full conversation history (fix provider plumbing bug)
- [ ] SSH subagent drill-down loads correctly over SFTP
- [ ] Multiple service contexts coexist (local always alive, SSH contexts independent)
- [ ] Context switching preserves full state (tabs, sidebar, notifications, selections)
- [ ] Workspace switcher in sidebar for switching between contexts
- [ ] Status bar indicator showing active workspace and connection status
- [ ] SSH file watchers stay alive in background while connected
- [ ] Loading overlay during context switch (prevent stale data flash)
- [ ] Switching to local restores all previous local state exactly
- [ ] Connection profiles saved in settings for quick reconnection

### Out of Scope

- SFTP performance optimization — investigating separately after workspace switching works
- SSH key management UI — use system SSH keys
- Multiple simultaneous SSH sessions visible side-by-side — workspace model is one-at-a-time switching
- Mobile/responsive layout for SSH features — desktop only

## Context

The existing SSH integration (commits 4b56186, 921420b, ad4e75b) established SFTP-based file system access and connection management. However, several critical issues surfaced:

1. **"No conversation history" bug**: `SessionParser`, `SubagentResolver`, and `SubagentDetailBuilder` don't pass the SSH `FileSystemProvider` to `parseJsonlFile()`, so JSONL parsing falls back to local filesystem and finds nothing.

2. **Stale sidebar during transitions**: Fire-and-forget fetches with no loading state means old local data is visible while SSH data loads.

3. **Destructive mode switch**: Connecting SSH destroys local services; disconnecting destroys SSH state. No way to switch back without re-fetching everything.

Reference design document: `~/.claude/plans/mighty-soaring-moore.md` — contains detailed implementation notes for all 4 phases including specific file changes, line numbers, and code patterns.

Brownfield codebase map: `.planning/codebase/` — 7 documents covering stack, architecture, structure, conventions, testing, integrations, and concerns.

## Constraints

- **Tech stack**: Electron 28.x, React 18.x, TypeScript 5.x, Zustand 4.x — no new frameworks
- **Architecture**: Must use existing IPC bridge pattern (main process services + preload API + renderer store)
- **Backward compatibility**: Local-only mode must work identically to current behavior
- **State isolation**: Each workspace must have fully independent Zustand state slices

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| ServiceContextRegistry in main process | Centralizes context lifecycle, avoids scattered service variable management | -- Pending |
| Snapshot/restore for Zustand state | Instant switching without refetching; preserves exact user state | -- Pending |
| Workspace indicators in sidebar + status bar | Sidebar for active switching, status bar for passive awareness (VS Code model) | -- Pending |
| SSH watchers stay alive in background | Users expect real-time updates even for non-active workspaces; disconnect is explicit | -- Pending |
| Performance optimization deferred | Focus on correctness and UX first, investigate SFTP latency separately | -- Pending |

---
*Last updated: 2026-02-12 after initialization*
