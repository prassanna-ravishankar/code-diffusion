import { CodebaseScanner } from '../src/agents/codebase-scanner';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('CodebaseScanner', () => {
  let scanner: CodebaseScanner;
  let tempDir: string;

  beforeEach(async () => {
    scanner = new CodebaseScanner({
      maxDepth: 5,
      respectGitignore: false, // Disable for tests
    });

    // Create a temporary test directory
    tempDir = path.join(process.cwd(), 'test-temp-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('scan', () => {
    it('should scan an empty directory', async () => {
      const result = await scanner.scan(tempDir);

      expect(result.totalFiles).toBe(0);
      expect(result.directories.length).toBe(0);
      expect(result.totalSize).toBe(0);
    });

    it('should scan a directory with files', async () => {
      // Create test files
      await fs.writeFile(path.join(tempDir, 'test.ts'), 'console.log("test")');
      await fs.writeFile(path.join(tempDir, 'README.md'), '# Test');

      const result = await scanner.scan(tempDir);

      expect(result.totalFiles).toBe(2);
      expect(result.files).toHaveLength(2);
      expect(result.files.some((f) => f.relativePath === 'test.ts')).toBe(true);
      expect(result.files.some((f) => f.relativePath === 'README.md')).toBe(true);
    });

    it('should categorize files correctly', async () => {
      // Create various file types
      await fs.writeFile(path.join(tempDir, 'index.ts'), 'export {}');
      await fs.writeFile(path.join(tempDir, 'utils.ts'), 'export function helper() {}');
      await fs.writeFile(path.join(tempDir, 'config.json'), '{}');
      await fs.writeFile(path.join(tempDir, 'README.md'), '# Readme');
      await fs.mkdir(path.join(tempDir, '__tests__'), { recursive: true });
      await fs.writeFile(path.join(tempDir, '__tests__', 'app.test.ts'), 'test()');

      const result = await scanner.scan(tempDir);

      // At minimum we should have files
      expect(result.totalFiles).toBeGreaterThanOrEqual(4);
      expect(result.files).toBeDefined();
      expect(result.files.length).toBeGreaterThanOrEqual(4);

      // Check that we have at least one of each category
      const hasSource = result.files.some((f) => f.type === 'source');
      const hasConfig = result.files.some((f) => f.type === 'config');
      const hasDocs = result.files.some((f) => f.type === 'documentation');
      const hasTest = result.files.some((f) => f.type === 'test');

      expect(hasSource).toBe(true);
      expect(hasConfig).toBe(true);
      expect(hasDocs).toBe(true);
      expect(hasTest).toBe(true);
    });

    it('should scan nested directories', async () => {
      // Create nested structure
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'src', 'utils'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), 'export {}');
      await fs.writeFile(path.join(tempDir, 'src', 'utils', 'helper.ts'), 'export {}');

      const result = await scanner.scan(tempDir);

      expect(result.totalFiles).toBe(2);
      expect(result.directories.length).toBeGreaterThanOrEqual(2);
      expect(result.directories).toContain('src');
      expect(result.directories.some((d) => d.includes('utils'))).toBe(true);
    });

    it('should respect max depth', async () => {
      const shallowScanner = new CodebaseScanner({ maxDepth: 1 });

      // Create deep nested structure
      await fs.mkdir(path.join(tempDir, 'a', 'b', 'c'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'root.txt'), 'root');
      await fs.writeFile(path.join(tempDir, 'a', 'level1.txt'), 'level1');
      await fs.writeFile(path.join(tempDir, 'a', 'b', 'level2.txt'), 'level2');
      await fs.writeFile(path.join(tempDir, 'a', 'b', 'c', 'level3.txt'), 'level3');

      const result = await shallowScanner.scan(tempDir);

      // Should get root.txt and level1.txt, but not deeper files
      expect(result.totalFiles).toBeLessThanOrEqual(2);
    });
  });

  describe('getKeyFiles', () => {
    it('should identify key configuration files', async () => {
      await fs.writeFile(path.join(tempDir, 'package.json'), '{}');
      await fs.writeFile(path.join(tempDir, 'tsconfig.json'), '{}');
      await fs.writeFile(path.join(tempDir, 'README.md'), '# Test');
      await fs.writeFile(path.join(tempDir, 'random.txt'), 'random');

      const result = await scanner.scan(tempDir);
      const keyFiles = scanner.getKeyFiles(result);

      expect(keyFiles.length).toBeGreaterThanOrEqual(2);
      expect(keyFiles.some((f) => f.relativePath === 'package.json')).toBe(true);
      expect(keyFiles.some((f) => f.relativePath === 'tsconfig.json')).toBe(true);
    });
  });

  describe('readFile', () => {
    it('should read file contents', async () => {
      const content = 'test file content';
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, content);

      const result = await scanner.readFile(filePath);

      expect(result).toBe(content);
    });

    it('should return null for non-existent files', async () => {
      const result = await scanner.readFile(path.join(tempDir, 'nonexistent.txt'));

      expect(result).toBeNull();
    });
  });
});
