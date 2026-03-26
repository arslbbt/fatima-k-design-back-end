import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export type StorageFolder = 'fittings' | 'inspirations' | 'documents';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly storagePath: string;
  private readonly publicUrl: string;

  constructor(private config: ConfigService) {
    this.storagePath = this.config.get<string>('storage.path')!;
    this.publicUrl = this.config.get<string>('storage.publicUrl')!;
  }

  /** Absolute path to the user's folder for a given category */
  getUserFolderPath(userId: string, folder: StorageFolder): string {
    return path.join(this.storagePath, userId, folder);
  }

  /** Ensure the directory exists, create it if not */
  ensureDir(userId: string, folder: StorageFolder): string {
    const dir = this.getUserFolderPath(userId, folder);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  /** Generate a safe, unique filename */
  buildFilename(originalName: string): string {
    const ext = path.extname(originalName).toLowerCase();
    const base = path
      .basename(originalName, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .slice(0, 60);
    return `${Date.now()}-${base}${ext}`;
  }

  /** Build the public-facing URL for a stored file */
  buildPublicUrl(
    userId: string,
    folder: StorageFolder,
    filename: string,
  ): string {
    return `${this.publicUrl}/files/${userId}/${folder}/${filename}`;
  }

  /**
   * Save a file buffer to disk.
   * Returns the public URL.
   */
  saveFile(
    userId: string,
    folder: StorageFolder,
    originalName: string,
    buffer: Buffer,
  ): string {
    const dir = this.ensureDir(userId, folder);
    const filename = this.buildFilename(originalName);
    const fullPath = path.join(dir, filename);

    // Prevent path traversal
    const resolvedPath = path.resolve(fullPath);
    const resolvedStorage = path.resolve(this.storagePath);
    if (!resolvedPath.startsWith(resolvedStorage)) {
      throw new Error('Invalid file path — path traversal detected');
    }

    fs.writeFileSync(fullPath, buffer);
    this.logger.log(`Saved file: ${fullPath}`);
    return this.buildPublicUrl(userId, folder, filename);
  }

  /**
   * Delete a file from disk given its public URL.
   * Silently ignores if file doesn't exist.
   */
  deleteByUrl(fileUrl: string): void {
    try {
      // Strip the public URL prefix to get the relative path
      const prefix = `${this.publicUrl}/files/`;
      if (!fileUrl.startsWith(prefix)) return;

      const relativePath = fileUrl.slice(prefix.length);
      const fullPath = path.join(this.storagePath, relativePath);

      // Prevent path traversal
      const resolvedPath = path.resolve(fullPath);
      const resolvedStorage = path.resolve(this.storagePath);
      if (!resolvedPath.startsWith(resolvedStorage)) return;

      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        this.logger.log(`Deleted file: ${fullPath}`);
      }
    } catch (err) {
      this.logger.error(`Failed to delete file: ${fileUrl}`, err);
    }
  }
}
