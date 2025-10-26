/**
 * Codebase Scanner for Bootstrapper Agent
 * Handles file system traversal and file categorization
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../utils/logger';

const logger = createLogger('CodebaseScanner');

export interface ScanOptions {
  maxDepth?: number;
  maxFileSize?: number; // in bytes
  followSymlinks?: boolean;
  respectGitignore?: boolean;
}

export interface ScannedFile {
  path: string;
  relativePath: string;
  type: FileType;
  size: number;
  extension: string;
}

export type FileType =
  | 'source'
  | 'config'
  | 'documentation'
  | 'test'
  | 'asset'
  | 'dependency'
  | 'other';

export interface ScanResult {
  files: ScannedFile[];
  directories: string[];
  totalFiles: number;
  totalSize: number;
  fileTypes: Record<FileType, number>;
}

/**
 * Default gitignore patterns
 */
const DEFAULT_IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  'out',
  '.cache',
  '.DS_Store',
  'Thumbs.db',
  '*.log',
  '.env',
  '.env.local',
  '.vscode',
  '.idea',
];

/**
 * File extension to type mapping
 */
const EXTENSION_TYPE_MAP: Record<string, FileType> = {
  // Source files
  '.ts': 'source',
  '.tsx': 'source',
  '.js': 'source',
  '.jsx': 'source',
  '.py': 'source',
  '.java': 'source',
  '.go': 'source',
  '.rs': 'source',
  '.c': 'source',
  '.cpp': 'source',
  '.h': 'source',
  '.hpp': 'source',
  '.cs': 'source',
  '.rb': 'source',
  '.php': 'source',
  '.swift': 'source',
  '.kt': 'source',

  // Config files
  '.json': 'config',
  '.yaml': 'config',
  '.yml': 'config',
  '.toml': 'config',
  '.ini': 'config',
  '.env': 'config',
  '.config': 'config',

  // Documentation
  '.md': 'documentation',
  '.mdx': 'documentation',
  '.txt': 'documentation',
  '.rst': 'documentation',
  '.adoc': 'documentation',

  // Test files
  '.test.ts': 'test',
  '.test.js': 'test',
  '.spec.ts': 'test',
  '.spec.js': 'test',

  // Assets
  '.png': 'asset',
  '.jpg': 'asset',
  '.jpeg': 'asset',
  '.gif': 'asset',
  '.svg': 'asset',
  '.ico': 'asset',
  '.webp': 'asset',
  '.css': 'asset',
  '.scss': 'asset',
  '.sass': 'asset',
  '.less': 'asset',
};

export class CodebaseScanner {
  private options: Required<ScanOptions>;
  private ignorePatterns: string[];
  private gitignorePatterns: string[] = [];

  constructor(options: ScanOptions = {}) {
    this.options = {
      maxDepth: options.maxDepth ?? 10,
      maxFileSize: options.maxFileSize ?? 10 * 1024 * 1024, // 10MB default
      followSymlinks: options.followSymlinks ?? false,
      respectGitignore: options.respectGitignore ?? true,
    };

    this.ignorePatterns = [...DEFAULT_IGNORE_PATTERNS];
  }

  /**
   * Scan a codebase directory
   */
  async scan(basePath: string): Promise<ScanResult> {
    logger.info('Starting codebase scan', { basePath, options: this.options });

    // Load gitignore if requested
    if (this.options.respectGitignore) {
      await this.loadGitignore(basePath);
    }

    const result: ScanResult = {
      files: [],
      directories: [],
      totalFiles: 0,
      totalSize: 0,
      fileTypes: {
        source: 0,
        config: 0,
        documentation: 0,
        test: 0,
        asset: 0,
        dependency: 0,
        other: 0,
      },
    };

    await this.scanDirectory(basePath, basePath, 0, result);

    logger.info('Codebase scan complete', {
      totalFiles: result.totalFiles,
      totalSize: result.totalSize,
      fileTypes: result.fileTypes,
    });

    return result;
  }

  /**
   * Load .gitignore patterns
   */
  private async loadGitignore(basePath: string): Promise<void> {
    const gitignorePath = path.join(basePath, '.gitignore');

    try {
      const content = await fs.readFile(gitignorePath, 'utf-8');
      this.gitignorePatterns = content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));

      logger.debug('Loaded gitignore patterns', { count: this.gitignorePatterns.length });
    } catch (error) {
      logger.debug('No .gitignore found or error reading it', { error });
    }
  }

  /**
   * Recursively scan a directory
   */
  private async scanDirectory(
    basePath: string,
    currentPath: string,
    depth: number,
    result: ScanResult
  ): Promise<void> {
    if (depth > this.options.maxDepth) {
      logger.debug('Max depth reached', { currentPath, depth });
      return;
    }

    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        const relativePath = path.relative(basePath, fullPath);

        // Check if should be ignored
        if (this.shouldIgnore(relativePath, entry.name)) {
          continue;
        }

        if (entry.isDirectory()) {
          result.directories.push(relativePath);
          await this.scanDirectory(basePath, fullPath, depth + 1, result);
        } else if (entry.isFile()) {
          const fileInfo = await this.processFile(basePath, fullPath);
          if (fileInfo) {
            result.files.push(fileInfo);
            result.totalFiles++;
            result.totalSize += fileInfo.size;
            result.fileTypes[fileInfo.type]++;
          }
        } else if (entry.isSymbolicLink() && this.options.followSymlinks) {
          // Handle symlinks if enabled
          try {
            const stats = await fs.stat(fullPath);
            if (stats.isDirectory()) {
              result.directories.push(relativePath);
              await this.scanDirectory(basePath, fullPath, depth + 1, result);
            }
          } catch (error) {
            logger.warn('Error following symlink', { fullPath, error });
          }
        }
      }
    } catch (error) {
      logger.error('Error scanning directory', { currentPath, error });
    }
  }

  /**
   * Process a single file
   */
  private async processFile(basePath: string, fullPath: string): Promise<ScannedFile | null> {
    try {
      const stats = await fs.stat(fullPath);

      // Check file size limit
      if (stats.size > this.options.maxFileSize) {
        logger.debug('File exceeds size limit', { fullPath, size: stats.size });
        return null;
      }

      const relativePath = path.relative(basePath, fullPath);
      const extension = path.extname(fullPath).toLowerCase();
      const fileType = this.categorizeFile(fullPath, extension);

      return {
        path: fullPath,
        relativePath,
        type: fileType,
        size: stats.size,
        extension,
      };
    } catch (error) {
      logger.warn('Error processing file', { fullPath, error });
      return null;
    }
  }

  /**
   * Categorize a file based on its path and extension
   */
  private categorizeFile(filePath: string, extension: string): FileType {
    const fileName = path.basename(filePath);
    const relativeDirName = path.dirname(filePath);

    // Check for test files - be specific to avoid false positives
    if (fileName.includes('.test.') || fileName.includes('.spec.')) {
      return 'test';
    }

    // Check if file is in a test directory (look for exact test directory names)
    const pathParts = relativeDirName.split(path.sep);
    const hasTestDir = pathParts.some(
      (part) =>
        part === 'test' ||
        part === 'tests' ||
        part === '__tests__' ||
        part === '__test__' ||
        part === 'spec' ||
        part === 'specs'
    );

    if (hasTestDir) {
      return 'test';
    }

    // Check for dependency files
    if (
      fileName === 'package.json' ||
      fileName === 'package-lock.json' ||
      fileName === 'yarn.lock' ||
      fileName === 'pnpm-lock.yaml' ||
      fileName === 'Cargo.toml' ||
      fileName === 'go.mod' ||
      fileName === 'requirements.txt' ||
      fileName === 'Pipfile'
    ) {
      return 'dependency';
    }

    // Check for config files
    if (
      fileName.startsWith('.') ||
      fileName.endsWith('rc') ||
      fileName.endsWith('.config.js') ||
      fileName.endsWith('.config.ts')
    ) {
      return 'config';
    }

    // Use extension mapping
    return EXTENSION_TYPE_MAP[extension] || 'other';
  }

  /**
   * Check if a path should be ignored
   */
  private shouldIgnore(relativePath: string, fileName: string): boolean {
    // Check default ignore patterns
    for (const pattern of this.ignorePatterns) {
      if (relativePath.includes(pattern) || fileName === pattern) {
        return true;
      }
    }

    // Check gitignore patterns
    for (const pattern of this.gitignorePatterns) {
      if (this.matchesPattern(relativePath, pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Simple pattern matching for gitignore-style patterns
   */
  private matchesPattern(path: string, pattern: string): boolean {
    // Remove leading/trailing slashes
    const cleanPattern = pattern.replace(/^\/|\/$/g, '');
    const cleanPath = path.replace(/^\/|\/$/g, '');

    // Exact match
    if (cleanPath === cleanPattern) {
      return true;
    }

    // Directory match
    if (pattern.endsWith('/') && cleanPath.startsWith(cleanPattern)) {
      return true;
    }

    // Wildcard match (simple implementation)
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(cleanPath);
    }

    // Path segment match
    return cleanPath.includes(cleanPattern);
  }

  /**
   * Read file content
   */
  async readFile(filePath: string): Promise<string | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      logger.error('Error reading file', { filePath, error });
      return null;
    }
  }

  /**
   * Get key files from scan result
   */
  getKeyFiles(result: ScanResult): ScannedFile[] {
    const keyFileNames = [
      'package.json',
      'tsconfig.json',
      'README.md',
      'Cargo.toml',
      'go.mod',
      'pom.xml',
      'build.gradle',
      'requirements.txt',
      'Gemfile',
      'composer.json',
    ];

    return result.files.filter((file) =>
      keyFileNames.some((keyFile) => file.relativePath.endsWith(keyFile))
    );
  }
}
