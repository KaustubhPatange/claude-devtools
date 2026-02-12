/**
 * Context Slice - Manages context switching lifecycle.
 *
 * Orchestrates snapshot capture/restore for instant workspace switching
 * between local and SSH contexts, with IndexedDB persistence and TTL.
 */

import { api } from '@renderer/api';
import { contextStorage } from '@renderer/services/contextStorage';

import { getFullResetState } from '../utils/stateResetHelpers';

import type { AppState } from '../types';
import type { ContextSnapshot } from '@renderer/services/contextStorage';
import type { DetectedError, Project, RepositoryGroup } from '@renderer/types/data';
import type { Pane } from '@renderer/types/panes';
import type { Tab } from '@renderer/types/tabs';
import type { ContextInfo } from '@shared/types/api';
import type { StateCreator } from 'zustand';

// =============================================================================
// Slice Interface
// =============================================================================

export interface ContextSlice {
  // State
  activeContextId: string; // 'local' initially
  isContextSwitching: boolean; // true during switch transition
  targetContextId: string | null; // context being switched to
  contextSnapshotsReady: boolean; // true after initial IndexedDB check
  availableContexts: ContextInfo[]; // list of all available contexts (local + SSH)

  // Actions
  switchContext: (targetContextId: string) => Promise<void>;
  initializeContextSystem: () => Promise<void>;
  fetchAvailableContexts: () => Promise<void>;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get empty context state for fresh contexts.
 * Returns state with empty arrays, null selections, and default dashboard tab.
 */
function getEmptyContextState(): Partial<AppState> {
  return {
    ...getFullResetState(),
    projects: [],
    repositoryGroups: [],
    sessions: [],
    notifications: [],
    unreadCount: 0,
    openTabs: [],
    activeTabId: null,
    selectedTabIds: [],
    activeProjectId: null,
    paneLayout: {
      panes: [
        {
          id: 'pane-default',
          tabs: [],
          activeTabId: null,
          selectedTabIds: [],
          widthFraction: 1,
        },
      ],
      focusedPaneId: 'pane-default',
    },
  };
}

/**
 * Validate snapshot against fresh data from target context.
 * Filters invalid tabs, selections, and ensures at-least-one-pane invariant.
 */
function validateSnapshot(
  snapshot: ContextSnapshot,
  freshProjects: Project[],
  freshRepoGroups: RepositoryGroup[]
): Partial<AppState> {
  const validProjectIds = new Set(freshProjects.map((p) => p.id));
  const validWorktreeIds = new Set(freshRepoGroups.flatMap((rg) => rg.worktrees.map((w) => w.id)));

  // Validate selectedProjectId
  const selectedProjectId =
    snapshot.selectedProjectId && validProjectIds.has(snapshot.selectedProjectId)
      ? snapshot.selectedProjectId
      : null;

  // Validate selectedRepositoryId and selectedWorktreeId
  const selectedRepositoryId = snapshot.selectedRepositoryId; // repos may differ but allow graceful fallback
  const selectedWorktreeId =
    snapshot.selectedWorktreeId && validWorktreeIds.has(snapshot.selectedWorktreeId)
      ? snapshot.selectedWorktreeId
      : null;

  // Validate tabs — filter out session tabs referencing invalid projects
  const validTabs = snapshot.openTabs.filter((tab) => {
    if (tab.type === 'session' && tab.projectId) {
      return validProjectIds.has(tab.projectId) || validWorktreeIds.has(tab.projectId);
    }
    return true; // Keep dashboard and non-session tabs
  });

  // Validate activeTabId
  let activeTabId = snapshot.activeTabId;
  if (activeTabId && !validTabs.find((t) => t.id === activeTabId)) {
    activeTabId = validTabs[0]?.id ?? null;
  }

  // Validate pane layout tabs
  const validatedPanes = snapshot.paneLayout.panes
    .map((pane) => {
      const paneTabs = pane.tabs.filter((tab) => {
        if (tab.type === 'session' && tab.projectId) {
          return validProjectIds.has(tab.projectId) || validWorktreeIds.has(tab.projectId);
        }
        return true;
      });
      const paneActiveId = paneTabs.find((t) => t.id === pane.activeTabId)
        ? pane.activeTabId
        : (paneTabs[0]?.id ?? null);
      return {
        ...pane,
        tabs: paneTabs,
        activeTabId: paneActiveId,
        selectedTabIds: pane.selectedTabIds.filter((id) => paneTabs.some((t) => t.id === id)),
      };
    })
    .filter((pane) => pane.tabs.length > 0); // Remove empty panes

  // Ensure at least one pane exists
  const finalPanes: Pane[] =
    validatedPanes.length > 0
      ? validatedPanes
      : [
          {
            id: 'pane-default',
            tabs: [],
            activeTabId: null,
            selectedTabIds: [],
            widthFraction: 1,
          },
        ];

  return {
    // Restored from snapshot (use fresh data for projects/repoGroups)
    projects: freshProjects,
    selectedProjectId,
    repositoryGroups: freshRepoGroups,
    selectedRepositoryId,
    selectedWorktreeId,
    viewMode: snapshot.viewMode,
    sessions: snapshot.sessions,
    selectedSessionId: snapshot.selectedSessionId,
    sessionsCursor: snapshot.sessionsCursor,
    sessionsHasMore: snapshot.sessionsHasMore,
    sessionsTotalCount: snapshot.sessionsTotalCount,
    pinnedSessionIds: snapshot.pinnedSessionIds,
    notifications: snapshot.notifications,
    unreadCount: snapshot.unreadCount,
    openTabs: validTabs,
    activeTabId,
    selectedTabIds: snapshot.selectedTabIds.filter((id) => validTabs.some((t) => t.id === id)),
    activeProjectId:
      snapshot.activeProjectId &&
      (validProjectIds.has(snapshot.activeProjectId) ||
        validWorktreeIds.has(snapshot.activeProjectId))
        ? snapshot.activeProjectId
        : selectedProjectId,
    paneLayout: {
      panes: finalPanes,
      focusedPaneId: finalPanes.find((p) => p.id === snapshot.paneLayout.focusedPaneId)
        ? snapshot.paneLayout.focusedPaneId
        : finalPanes[0].id,
    },
    sidebarCollapsed: snapshot.sidebarCollapsed,
  };
}

/**
 * Capture current context state as a snapshot.
 * Excludes transient state (loading flags, errors, search, Maps/Sets).
 */
function captureSnapshot(state: AppState, contextId: string): ContextSnapshot {
  return {
    // Data state
    projects: state.projects,
    selectedProjectId: state.selectedProjectId,
    repositoryGroups: state.repositoryGroups,
    selectedRepositoryId: state.selectedRepositoryId,
    selectedWorktreeId: state.selectedWorktreeId,
    viewMode: state.viewMode,
    sessions: state.sessions,
    selectedSessionId: state.selectedSessionId,
    sessionsCursor: state.sessionsCursor,
    sessionsHasMore: state.sessionsHasMore,
    sessionsTotalCount: state.sessionsTotalCount,
    pinnedSessionIds: state.pinnedSessionIds,
    notifications: state.notifications,
    unreadCount: state.unreadCount,

    // Tab/pane state
    openTabs: state.openTabs,
    activeTabId: state.activeTabId,
    selectedTabIds: state.selectedTabIds,
    activeProjectId: state.activeProjectId,
    paneLayout: state.paneLayout,

    // UI state
    sidebarCollapsed: state.sidebarCollapsed,

    // Metadata
    _metadata: {
      contextId,
      capturedAt: Date.now(),
      version: 1,
    },
  };
}

// =============================================================================
// Slice Creator
// =============================================================================

export const createContextSlice: StateCreator<AppState, [], [], ContextSlice> = (set, get) => ({
  // Initial state
  activeContextId: 'local',
  isContextSwitching: false,
  targetContextId: null,
  contextSnapshotsReady: false,
  availableContexts: [{ id: 'local', type: 'local' as const }],

  // Initialize context system (called once on app mount)
  initializeContextSystem: async () => {
    try {
      // Check IndexedDB availability
      const available = await contextStorage.isAvailable();
      if (available) {
        // Clean up expired snapshots
        void contextStorage.cleanupExpired();
      }

      // Fetch active context from main process
      const activeContextId = await api.context.getActive();

      set({
        contextSnapshotsReady: true,
        activeContextId,
      });

      // Fetch available contexts
      await get().fetchAvailableContexts();
    } catch (error) {
      console.error('[contextSlice] Failed to initialize context system:', error);
      set({ contextSnapshotsReady: true }); // Continue anyway
    }
  },

  // Fetch list of available contexts (local + SSH)
  fetchAvailableContexts: async () => {
    try {
      const result = await api.context.list();
      set({ availableContexts: result });
    } catch (error) {
      console.error('[contextSlice] Failed to fetch available contexts:', error);
      // Fallback to local-only
      set({ availableContexts: [{ id: 'local', type: 'local' }] });
    }
  },

  // Switch to a different context
  switchContext: async (targetContextId: string) => {
    const state = get();

    // Early return if already on target context
    if (targetContextId === state.activeContextId) {
      return;
    }

    set({
      isContextSwitching: true,
      targetContextId,
    });

    try {
      // Step 1: Capture current context's snapshot
      const currentSnapshot = captureSnapshot(state, state.activeContextId);
      await contextStorage.saveSnapshot(state.activeContextId, currentSnapshot);

      // Step 2: Switch main process context
      await api.context.switch(targetContextId);

      // Step 3: Fetch fresh data from target context
      const [freshProjects, freshRepoGroups] = await Promise.all([
        api.getProjects(),
        api.getRepositoryGroups(),
      ]);

      // Step 4: Attempt to restore snapshot for target context
      const targetSnapshot = await contextStorage.loadSnapshot(targetContextId);

      if (targetSnapshot) {
        // Validate and restore snapshot
        const validatedState = validateSnapshot(targetSnapshot, freshProjects, freshRepoGroups);
        set(validatedState);
      } else {
        // No snapshot (new context or expired) - apply empty state
        const emptyState = getEmptyContextState();
        set({
          ...emptyState,
          projects: freshProjects,
          repositoryGroups: freshRepoGroups,
        });
      }

      // Step 5: Fetch notifications in background
      void get().fetchNotifications();

      // Step 6: Finalize switch
      set({
        isContextSwitching: false,
        targetContextId: null,
        activeContextId: targetContextId,
      });
    } catch (error) {
      console.error('[contextSlice] Failed to switch context:', error);
      // Do NOT leave in broken state
      set({
        isContextSwitching: false,
        targetContextId: null,
      });
    }
  },
});
