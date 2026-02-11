/**
 * SshFileSystemProvider - FileSystemProvider backed by SSH2 SFTP.
 *
 * Wraps an ssh2 SFTPWrapper to provide the same filesystem interface
 * used by session-data services, enabling remote file access.
 */

import { createLogger } from '@shared/utils/logger';
import { PassThrough, type Readable } from 'stream';

import type {
  FileSystemProvider,
  FsDirent,
  FsStatResult,
  ReadStreamOptions,
} from './FileSystemProvider';
import type { SFTPWrapper } from 'ssh2';

const logger = createLogger('Infrastructure:SshFileSystemProvider');

export class SshFileSystemProvider implements FileSystemProvider {
  readonly type = 'ssh' as const;
  private sftp: SFTPWrapper;

  constructor(sftp: SFTPWrapper) {
    this.sftp = sftp;
  }

  async exists(filePath: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.sftp.stat(filePath, (err) => {
        resolve(!err);
      });
    });
  }

  async readFile(filePath: string, encoding: BufferEncoding = 'utf8'): Promise<string> {
    return new Promise((resolve, reject) => {
      this.sftp.readFile(filePath, { encoding }, (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(data as unknown as string);
      });
    });
  }

  async stat(filePath: string): Promise<FsStatResult> {
    return new Promise((resolve, reject) => {
      this.sftp.stat(filePath, (err, stats) => {
        if (err) {
          reject(err);
          return;
        }
        // SFTP stats use mode bitmask for file type detection
        const S_IFMT = 0o170000;
        const S_IFREG = 0o100000;
        const S_IFDIR = 0o040000;
        const mode = stats.mode;

        resolve({
          size: stats.size,
          mtimeMs: (stats.mtime ?? 0) * 1000,
          // SFTP doesn't provide birth time, use mtime as fallback
          birthtimeMs: (stats.mtime ?? 0) * 1000,
          isFile: () => (mode & S_IFMT) === S_IFREG,
          isDirectory: () => (mode & S_IFMT) === S_IFDIR,
        });
      });
    });
  }

  async readdir(dirPath: string): Promise<FsDirent[]> {
    return new Promise((resolve, reject) => {
      this.sftp.readdir(dirPath, (err, list) => {
        if (err) {
          reject(err);
          return;
        }
        const S_IFMT = 0o170000;
        const S_IFREG = 0o100000;
        const S_IFDIR = 0o040000;

        const entries: FsDirent[] = list.map((item) => {
          const mode = item.attrs.mode;
          return {
            name: item.filename,
            isFile: () => (mode & S_IFMT) === S_IFREG,
            isDirectory: () => (mode & S_IFMT) === S_IFDIR,
          };
        });
        resolve(entries);
      });
    });
  }

  createReadStream(filePath: string, opts?: ReadStreamOptions): Readable {
    try {
      const sftpStream = this.sftp.createReadStream(filePath, {
        start: opts?.start,
        encoding: opts?.encoding ?? undefined,
      });

      // Wrap in PassThrough to ensure Node Readable compatibility
      const passthrough = new PassThrough();
      sftpStream.pipe(passthrough);
      sftpStream.on('error', (err: Error) => {
        passthrough.destroy(err);
      });

      return passthrough;
    } catch (err) {
      logger.error(`Error creating read stream for ${filePath}:`, err);
      // Return an errored stream
      const errStream = new PassThrough();
      process.nextTick(() => errStream.destroy(err as Error));
      return errStream;
    }
  }

  dispose(): void {
    try {
      this.sftp.end();
    } catch {
      // Ignore errors during cleanup
    }
  }
}
