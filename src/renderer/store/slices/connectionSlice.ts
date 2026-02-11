/**
 * Connection Slice - Manages SSH connection state.
 *
 * Tracks connection mode (local/ssh), connection state,
 * and provides actions for connecting/disconnecting.
 */

import type { AppState } from '../types';
import type { SshConnectionConfig, SshConnectionState } from '@shared/types';
import type { StateCreator } from 'zustand';

// =============================================================================
// Slice Interface
// =============================================================================

export interface ConnectionSlice {
  // State
  connectionMode: 'local' | 'ssh';
  connectionState: SshConnectionState;
  connectedHost: string | null;
  connectionError: string | null;

  // Actions
  connectSsh: (config: SshConnectionConfig) => Promise<void>;
  disconnectSsh: () => Promise<void>;
  testConnection: (config: SshConnectionConfig) => Promise<{ success: boolean; error?: string }>;
  setConnectionStatus: (
    state: SshConnectionState,
    host: string | null,
    error: string | null
  ) => void;
}

// =============================================================================
// Slice Creator
// =============================================================================

export const createConnectionSlice: StateCreator<AppState, [], [], ConnectionSlice> = (
  set,
  get
) => ({
  // Initial state
  connectionMode: 'local',
  connectionState: 'disconnected',
  connectedHost: null,
  connectionError: null,

  // Actions
  connectSsh: async (config: SshConnectionConfig): Promise<void> => {
    set({
      connectionState: 'connecting',
      connectedHost: config.host,
      connectionError: null,
    });

    try {
      const status = await window.electronAPI.ssh.connect(config);
      set({
        connectionMode: status.state === 'connected' ? 'ssh' : 'local',
        connectionState: status.state,
        connectedHost: status.host,
        connectionError: status.error,
      });

      // Re-fetch all data when connected
      if (status.state === 'connected') {
        const state = get();
        void state.fetchProjects();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({
        connectionState: 'error',
        connectionError: message,
      });
    }
  },

  disconnectSsh: async (): Promise<void> => {
    try {
      const status = await window.electronAPI.ssh.disconnect();
      set({
        connectionMode: 'local',
        connectionState: status.state,
        connectedHost: null,
        connectionError: null,
      });

      // Re-fetch local data
      const state = get();
      void state.fetchProjects();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ connectionError: message });
    }
  },

  testConnection: async (
    config: SshConnectionConfig
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      return await window.electronAPI.ssh.test(config);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  },

  setConnectionStatus: (
    state: SshConnectionState,
    host: string | null,
    error: string | null
  ): void => {
    set({
      connectionState: state,
      connectionMode: state === 'connected' ? 'ssh' : 'local',
      connectedHost: host,
      connectionError: error,
    });
  },
});
