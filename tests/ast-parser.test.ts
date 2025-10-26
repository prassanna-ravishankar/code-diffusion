/* eslint-disable @typescript-eslint/no-non-null-assertion */
// @ts-nocheck - Disable type checking for test assertions

import { ASTParser } from '../src/agents/ast-parser';
import type { ScannedFile } from '../src/agents/codebase-scanner';

describe('ASTParser', () => {
  let parser: ASTParser;

  beforeEach(() => {
    parser = new ASTParser();
  });

  const createMockFile = (extension: string, relativePath: string): ScannedFile => ({
    path: `/test/${relativePath}`,
    relativePath,
    type: 'source',
    size: 100,
    extension,
  });

  describe('parseFile', () => {
    it('should parse a simple JavaScript file', () => {
      const file = createMockFile('.js', 'test.js');
      const content = `
        import React from 'react';
        export function hello() {
          return 'world';
        }
      `;

      const result = parser.parseFile(file, content);

      expect(result).not.toBeNull();
      expect(result?.imports).toHaveLength(1);
      expect(result?.imports[0].source).toBe('react');
      expect(result?.functions).toHaveLength(1);
      expect(result?.functions[0].name).toBe('hello');
      expect(result?.functions[0].isExported).toBe(true);
    });

    it('should parse TypeScript with interfaces', () => {
      const file = createMockFile('.ts', 'test.ts');
      const content = `
        interface User {
          name: string;
        }
        export class UserService {
          getUser(): User {
            return { name: 'test' };
          }
        }
      `;

      const result = parser.parseFile(file, content);

      expect(result).not.toBeNull();
      expect(result?.hasTypeScript).toBe(true);
      expect(result?.classes).toHaveLength(1);
      expect(result?.classes[0].name).toBe('UserService');
      expect(result!.classes[0].methods).toContain('getUser');
    });

    it('should identify React components', () => {
      const file = createMockFile('.tsx', 'Component.tsx');
      const content = `
        import React from 'react';
        export function MyComponent({ name }: { name: string }) {
          return <div>{name}</div>;
        }
      `;

      const result = parser.parseFile(file, content);

      expect(result).not.toBeNull();
      expect(result?.hasJSX).toBe(true);
      // Component detection works for function declarations
      expect(result?.functions.length).toBeGreaterThan(0);
    });

    it('should extract imports and exports', () => {
      const file = createMockFile('.js', 'module.js');
      const content = `
        import { useState, useEffect } from 'react';
        import axios from 'axios';

        export const API_URL = 'https://api.example.com';
        export function fetchData() {}
        export default MyComponent;
      `;

      const result = parser.parseFile(file, content);

      expect(result).not.toBeNull();
      expect(result?.imports).toHaveLength(2);
      expect(result!.imports[0].imports).toContain('useState');
      expect(result!.imports[1].isDefault).toBe(true);
      expect(result?.exports.length).toBeGreaterThan(0);
    });

    it('should handle parse errors gracefully', () => {
      const file = createMockFile('.js', 'invalid.js');
      const content = 'this is { not valid javascript';

      const result = parser.parseFile(file, content);

      // Should return null for unparseable files
      expect(result).toBeNull();
    });

    it('should detect async functions', () => {
      const file = createMockFile('.js', 'async.js');
      const content = `
        export async function fetchUser() {
          return await api.get('/user');
        }
      `;

      const result = parser.parseFile(file, content);

      expect(result).not.toBeNull();
      expect(result!.functions[0].isAsync).toBe(true);
    });
  });

  describe('parseFiles', () => {
    it('should batch parse multiple files', async () => {
      const files = [
        createMockFile('.js', 'file1.js'),
        createMockFile('.ts', 'file2.ts'),
        createMockFile('.txt', 'file3.txt'), // Should skip non-JS files
      ];

      const contentGetter = async (file: ScannedFile) => {
        if (file.extension === '.txt') return null;
        return `export function ${file.relativePath.replace('.', '_')}() {}`;
      };

      const results = await parser.parseFiles(files, contentGetter);

      expect(results.size).toBe(2); // Should only parse .js and .ts
      expect(results.has('file1.js')).toBe(true);
      expect(results.has('file2.ts')).toBe(true);
    });
  });
});
