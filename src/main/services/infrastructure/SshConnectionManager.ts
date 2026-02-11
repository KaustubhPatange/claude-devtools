/**
 * SshConnectionManager - Manages SSH connection lifecycle.
 *
 * Responsibilities:
 * - Connect/disconnect SSH sessions
 * - Manage SFTP channel
 * - Provide FileSystemProvider (local or SSH) to services
 * - Emit connection state events for UI updates
 * - Handle reconnection on errors
 */

import { createLogger } from '@shared/utils/logger';
import { EventEmitter } from 'events';
import * as os from 'os';
import * as path from 'path';
import { Client, type ConnectConfig } from 'ssh2';

import { LocalFileSystemProvider } from './LocalFileSystemProvider';
import { SshFileSystemProvider } from './SshFileSystemProvider';

import type { FileSystemProvider } from './FileSystemProvider';

const logger = createLogger('Infrastructure:SshConnectionManager');

// =============================================================================
// Types
// =============================================================================

export type SshConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export type SshAuthMethod = 'password' | 'privateKey' | 'agent';

export interface SshConnectionConfig {
  host: string;
  port: number;
  username: string;
  authMethod: SshAuthMethod;
  password?: string;
  privateKeyPath?: string;
}

export interface SshConnectionProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: SshAuthMethod;
  privateKeyPath?: string;
}

export interface SshConnectionStatus {
  state: SshConnectionState;
  host: string | null;
  error: string | null;
  remoteProjectsPath: string | null;
}

// =============================================================================
// Connection Manager
// =============================================================================

export class SshConnectionManager extends EventEmitter {
  private client: Client | null = null;
  private provider: FileSystemProvider;
  private localProvider: LocalFileSystemProvider;
  private state: SshConnectionState = 'disconnected';
  private connectedHost: string | null = null;
  private lastError: string | null = null;
  private remoteProjectsPath: string | null = null;

  constructor() {
    super();
    this.localProvider = new LocalFileSystemProvider();
    this.provider = this.localProvider;
  }

  /**
   * Returns the current FileSystemProvider (local or SSH).
   */
  getProvider(): FileSystemProvider {
    return this.provider;
  }

  /**
   * Returns the current connection status.
   */
  getStatus(): SshConnectionStatus {
    return {
      state: this.state,
      host: this.connectedHost,
      error: this.lastError,
      remoteProjectsPath: this.remoteProjectsPath,
    };
  }

  /**
   * Returns the remote projects directory path.
   * Used by services to know where to scan on the remote machine.
   */
  getRemoteProjectsPath(): string | null {
    return this.remoteProjectsPath;
  }

  /**
   * Returns whether we're in SSH mode.
   */
  isRemote(): boolean {
    return this.state === 'connected' && this.provider.type === 'ssh';
  }

  /**
   * Connect to a remote SSH host.
   */
  async connect(config: SshConnectionConfig): Promise<void> {
    // Disconnect existing connection first
    if (this.client) {
      this.disconnect();
    }

    this.setState('connecting');
    this.connectedHost = config.host;

    try {
      const client = new Client();
      this.client = client;

      const connectConfig = await this.buildConnectConfig(config);

      await new Promise<void>((resolve, reject) => {
        client.on('ready', () => resolve());
        client.on('error', (err) => reject(err));
        client.connect(connectConfig);
      });

      // Open SFTP channel
      const sftp = await new Promise<ReturnType<Client['sftp']> extends void ? never : never>(
        (resolve, reject) => {
          client.sftp((err, sftp) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(sftp as never);
          });
        }
      );

      // Create SSH provider
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.provider = new SshFileSystemProvider(sftp as any);

      // Resolve remote ~/.claude/projects/ path
      this.remoteProjectsPath = await this.resolveRemoteProjectsPath(config.username);

      // Set up disconnect handler
      client.on('end', () => {
        logger.info('SSH connection ended');
        this.handleDisconnect();
      });

      client.on('close', () => {
        logger.info('SSH connection closed');
        this.handleDisconnect();
      });

      client.on('error', (err) => {
        logger.error('SSH connection error:', err);
        this.lastError = err.message;
        this.setState('error');
      });

      this.setState('connected');
      logger.info(`SSH connected to ${config.host}:${config.port}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`SSH connection failed: ${message}`);
      this.lastError = message;
      this.setState('error');
      this.cleanup();
      throw err;
    }
  }

  /**
   * Test a connection without switching to SSH mode.
   */
  async testConnection(config: SshConnectionConfig): Promise<{ success: boolean; error?: string }> {
    const testClient = new Client();

    try {
      const connectConfig = await this.buildConnectConfig(config);

      await new Promise<void>((resolve, reject) => {
        testClient.on('ready', () => resolve());
        testClient.on('error', (err) => reject(err));
        testClient.connect(connectConfig);
      });

      // Try to open SFTP to verify full access
      await new Promise<void>((resolve, reject) => {
        testClient.sftp((err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });

      testClient.end();
      return { success: true };
    } catch (err) {
      testClient.end();
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }

  /**
   * Disconnect and switch back to local mode.
   */
  disconnect(): void {
    this.cleanup();
    this.provider = this.localProvider;
    this.connectedHost = null;
    this.lastError = null;
    this.remoteProjectsPath = null;
    this.setState('disconnected');
    logger.info('Switched to local mode');
  }

  /**
   * Dispose of all resources.
   */
  dispose(): void {
    this.cleanup();
    this.localProvider.dispose();
    this.removeAllListeners();
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private async buildConnectConfig(config: SshConnectionConfig): Promise<ConnectConfig> {
    const connectConfig: ConnectConfig = {
      host: config.host,
      port: config.port,
      username: config.username,
      readyTimeout: 10000,
    };

    switch (config.authMethod) {
      case 'password':
        connectConfig.password = config.password;
        break;

      case 'privateKey': {
        const keyPath = config.privateKeyPath ?? path.join(os.homedir(), '.ssh', 'id_rsa');
        const { promises: fsPromises } = await import('fs');
        try {
          const keyData = await fsPromises.readFile(keyPath, 'utf8');
          connectConfig.privateKey = keyData;
        } catch (err) {
          throw new Error(`Cannot read private key at ${keyPath}: ${(err as Error).message}`);
        }
        break;
      }

      case 'agent':
        connectConfig.agent = process.env.SSH_AUTH_SOCK;
        if (!connectConfig.agent) {
          throw new Error('SSH_AUTH_SOCK environment variable is not set');
        }
        break;
    }

    return connectConfig;
  }

  private async resolveRemoteProjectsPath(username: string): Promise<string> {
    // Try to resolve the remote home directory
    // SFTP doesn't have a direct "get home dir" call, so we try common paths
    const candidates = [
      `/home/${username}/.claude/projects`,
      `/Users/${username}/.claude/projects`,
      `/root/.claude/projects`,
    ];

    for (const candidate of candidates) {
      if (await this.provider.exists(candidate)) {
        return candidate;
      }
    }

    // Fallback: try to read from environment via realpath of ~
    // Default to Linux convention
    return `/home/${username}/.claude/projects`;
  }

  private handleDisconnect(): void {
    if (this.state === 'disconnected') return;

    this.provider = this.localProvider;
    this.remoteProjectsPath = null;
    this.setState('disconnected');
  }

  private cleanup(): void {
    if (this.provider.type === 'ssh') {
      this.provider.dispose();
    }
    if (this.client) {
      try {
        this.client.end();
      } catch {
        // Ignore cleanup errors
      }
      this.client = null;
    }
  }

  private setState(state: SshConnectionState): void {
    this.state = state;
    this.emit('state-change', this.getStatus());
  }
}
