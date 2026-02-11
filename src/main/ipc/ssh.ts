/**
 * SSH IPC Handlers - Manages SSH connection lifecycle from renderer requests.
 *
 * Channels:
 * - ssh:connect - Connect to SSH host, switch to remote mode
 * - ssh:disconnect - Disconnect and switch back to local mode
 * - ssh:getState - Get current connection state
 * - ssh:test - Test connection without switching
 */

import {
  SSH_CONNECT,
  SSH_DISCONNECT,
  SSH_GET_STATE,
  SSH_TEST,
} from '@preload/constants/ipcChannels';
import { createLogger } from '@shared/utils/logger';

import type {
  SshConnectionConfig,
  SshConnectionManager,
  SshConnectionStatus,
} from '../services/infrastructure/SshConnectionManager';
import type { IpcMain } from 'electron';

const logger = createLogger('IPC:ssh');

// =============================================================================
// Module State
// =============================================================================

let connectionManager: SshConnectionManager;
let onModeSwitch: ((mode: 'local' | 'ssh') => Promise<void>) | null = null;

// =============================================================================
// Initialization
// =============================================================================

/**
 * Initialize SSH handlers with required services.
 * @param manager - The SSH connection manager instance
 * @param modeSwitchCallback - Called when switching between local/SSH mode
 */
export function initializeSshHandlers(
  manager: SshConnectionManager,
  modeSwitchCallback: (mode: 'local' | 'ssh') => Promise<void>
): void {
  connectionManager = manager;
  onModeSwitch = modeSwitchCallback;
}

// =============================================================================
// Handler Registration
// =============================================================================

export function registerSshHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(SSH_CONNECT, async (_event, config: SshConnectionConfig) => {
    try {
      await connectionManager.connect(config);
      if (onModeSwitch) {
        await onModeSwitch('ssh');
      }
      return { success: true, data: connectionManager.getStatus() };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('SSH connect failed:', message);
      return { success: false, error: message };
    }
  });

  ipcMain.handle(SSH_DISCONNECT, async () => {
    try {
      connectionManager.disconnect();
      if (onModeSwitch) {
        await onModeSwitch('local');
      }
      return { success: true, data: connectionManager.getStatus() };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('SSH disconnect failed:', message);
      return { success: false, error: message };
    }
  });

  ipcMain.handle(SSH_GET_STATE, async (): Promise<SshConnectionStatus> => {
    return connectionManager.getStatus();
  });

  ipcMain.handle(SSH_TEST, async (_event, config: SshConnectionConfig) => {
    try {
      const result = await connectionManager.testConnection(config);
      return { success: true, data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  logger.info('SSH handlers registered');
}

export function removeSshHandlers(ipcMain: IpcMain): void {
  ipcMain.removeHandler(SSH_CONNECT);
  ipcMain.removeHandler(SSH_DISCONNECT);
  ipcMain.removeHandler(SSH_GET_STATE);
  ipcMain.removeHandler(SSH_TEST);
}
