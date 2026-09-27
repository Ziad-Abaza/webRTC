import fs from 'fs/promises';
import path from 'path';
import { IStorageProvider } from '@nexusrtc/core';

export class LocalStorageProvider implements IStorageProvider {
  readonly name = 'local';
  private baseDir: string;

  constructor(baseDir: string = './storage/recordings') {
    this.baseDir = path.resolve(baseDir);
  }

  private async ensureDir(): Promise<void> {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
    } catch {
      // directory exists
    }
  }

  /**
   * Resolves and verifies that the target path does not escape baseDir.
   * Throws Error if path traversal is detected.
   */
  private resolveSafePath(key: string): string {
    if (key.includes('..') || path.isAbsolute(key)) {
      throw new Error(`Security Violation: Path traversal attempt detected for key '${key}'`);
    }
    const resolvedPath = path.resolve(this.baseDir, key);
    if (!resolvedPath.startsWith(this.baseDir)) {
      throw new Error(`Security Violation: Path traversal attempt detected for key '${key}'`);
    }
    return resolvedPath;
  }

  async upload(
    key: string,
    content: Buffer | Uint8Array,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<{ url: string; sizeBytes: number }> {
    await this.ensureDir();
    const filePath = this.resolveSafePath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, Buffer.from(content));

    if (metadata) {
      await fs.writeFile(`${filePath}.meta.json`, JSON.stringify(metadata, null, 2), 'utf-8');
    }

    return {
      url: `/api/v1/recordings/file/${encodeURIComponent(key)}`,
      sizeBytes: content.byteLength
    };
  }

  async getDownloadUrl(key: string): Promise<string> {
    return `/api/v1/recordings/file/${encodeURIComponent(key)}`;
  }

  async delete(key: string): Promise<boolean> {
    try {
      const filePath = this.resolveSafePath(key);
      await fs.unlink(filePath);
      try {
        await fs.unlink(`${filePath}.meta.json`);
      } catch {
        // ignore
      }
      return true;
    } catch {
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = this.resolveSafePath(key);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  getFilePath(key: string): string {
    return this.resolveSafePath(key);
  }
}
