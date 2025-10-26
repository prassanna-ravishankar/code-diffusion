/* eslint-disable @typescript-eslint/no-non-null-assertion */
// @ts-nocheck - Disable type checking for test assertions

import { DependencyAnalyzer } from '../src/agents/dependency-analyzer';
import type { ScannedFile } from '../src/agents/codebase-scanner';
import { cruise } from 'dependency-cruiser';

const mockCruise = cruise as jest.MockedFunction<typeof cruise>;

describe('DependencyAnalyzer', () => {
  let analyzer: DependencyAnalyzer;

  beforeEach(() => {
    analyzer = new DependencyAnalyzer({
      includeNodeModules: false,
      detectCircular: true,
    });

    // Reset mocks
    mockCruise.mockReset();
  });

  const createMockFile = (path: string, relativePath: string, extension: string): ScannedFile => ({
    path,
    relativePath,
    type: 'source',
    size: 100,
    extension,
  });

  const createMockCruiseResult = (modules: any[]) => ({
    output: {
      modules,
      summary: {
        violations: [],
      },
    },
    exitCode: 0,
  });

  describe('analyze', () => {
    it('should return null for empty file list', async () => {
      const result = await analyzer.analyze('/test', []);

      expect(result).toBeNull();
    });

    it('should return null for non-source files', async () => {
      const files = [
        createMockFile('/test/config.json', 'config.json', '.json'),
        createMockFile('/test/README.md', 'README.md', '.md'),
      ];

      const result = await analyzer.analyze('/test', files);

      expect(result).toBeNull();
    });

    it('should analyze a simple dependency graph', async () => {
      const files = [
        createMockFile('/test/moduleA.ts', 'moduleA.ts', '.ts'),
        createMockFile('/test/moduleB.ts', 'moduleB.ts', '.ts'),
      ];

      // Mock cruise response
      mockCruise.mockResolvedValue(
        createMockCruiseResult([
          {
            source: '/test/moduleA.ts',
            dependencies: [{ resolved: '/test/moduleB.ts' }],
            dependents: [],
            coreModule: false,
            couldNotResolve: false,
          },
          {
            source: '/test/moduleB.ts',
            dependencies: [],
            dependents: ['/test/moduleA.ts'],
            coreModule: false,
            couldNotResolve: false,
          },
        ])
      );

      const result = await analyzer.analyze('/test', files);

      expect(result).not.toBeNull();
      expect(result?.totalModules).toBe(2);
      expect(result?.moduleGraph).toHaveLength(2);
      expect(result?.moduleGraph[0].source).toBe('/test/moduleA.ts');
      expect(result?.moduleGraph[0].dependencies).toContain('/test/moduleB.ts');
    });

    it('should detect circular dependencies', async () => {
      const files = [
        createMockFile('/test/circA.ts', 'circA.ts', '.ts'),
        createMockFile('/test/circB.ts', 'circB.ts', '.ts'),
      ];

      // Mock cruise response with circular dependency
      mockCruise.mockResolvedValue({
        output: {
          modules: [
            {
              source: '/test/circA.ts',
              dependencies: [{ resolved: '/test/circB.ts' }],
              dependents: ['/test/circB.ts'],
            },
            {
              source: '/test/circB.ts',
              dependencies: [{ resolved: '/test/circA.ts' }],
              dependents: ['/test/circA.ts'],
            },
          ],
          summary: {
            violations: [
              {
                rule: { name: 'no-circular', severity: 'warn' },
                cycle: ['/test/circA.ts', '/test/circB.ts', '/test/circA.ts'],
              },
            ],
          },
        },
        exitCode: 1,
      });

      const result = await analyzer.analyze('/test', files);

      expect(result).not.toBeNull();
      expect(result?.circularDependencies.length).toBeGreaterThan(0);
      expect(result?.circularDependencies[0].cycle).toContain('/test/circA.ts');
      expect(result?.circularDependencies[0].severity).toBe('warning');
    });

    it('should calculate dependency metrics', async () => {
      const files = [
        createMockFile('/test/metricA.ts', 'metricA.ts', '.ts'),
        createMockFile('/test/metricB.ts', 'metricB.ts', '.ts'),
      ];

      mockCruise.mockResolvedValue(
        createMockCruiseResult([
          {
            source: '/test/metricA.ts',
            dependencies: [{ resolved: '/test/metricB.ts' }],
            dependents: [],
          },
          {
            source: '/test/metricB.ts',
            dependencies: [],
            dependents: ['/test/metricA.ts'],
          },
        ])
      );

      const result = await analyzer.analyze('/test', files);

      expect(result).not.toBeNull();
      expect(result?.metrics).toBeDefined();
      expect(result?.metrics.averageDependencies).toBeGreaterThanOrEqual(0);
      expect(result?.metrics.instabilityScore).toBeGreaterThanOrEqual(0);
      expect(result?.metrics.instabilityScore).toBeLessThanOrEqual(1);
    });
  });

  describe('analyzeFile', () => {
    it('should analyze a single file dependencies', async () => {
      mockCruise.mockResolvedValue(
        createMockCruiseResult([
          {
            source: '/test/single.ts',
            dependencies: [{ resolved: 'fs' }, { resolved: './helper' }],
            dependents: [],
            coreModule: false,
            couldNotResolve: false,
          },
        ])
      );

      const result = await analyzer.analyzeFile('/test/single.ts');

      expect(result).not.toBeNull();
      expect(result?.source).toBe('/test/single.ts');
      expect(result?.dependencies).toBeDefined();
      expect(result?.dependencies.length).toBeGreaterThan(0);
    });

    it('should return null for file with no modules', async () => {
      mockCruise.mockResolvedValue(createMockCruiseResult([]));

      const result = await analyzer.analyzeFile('/test/empty.ts');

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockCruise.mockRejectedValue(new Error('Test error'));

      const result = await analyzer.analyzeFile('/test/error.ts');

      expect(result).toBeNull();
    });
  });

  describe('hasCircularDependency', () => {
    it('should identify circular dependencies for a module', () => {
      const mockResult = {
        totalModules: 3,
        totalDependencies: 3,
        circularDependencies: [
          {
            cycle: ['moduleA.ts', 'moduleB.ts', 'moduleA.ts'],
            severity: 'warning' as const,
          },
        ],
        orphanModules: [],
        moduleGraph: [],
        externalDependencies: [],
        metrics: {
          averageDependencies: 1,
          maxDependencies: 1,
          mostDependendOn: 'moduleB.ts',
          instabilityScore: 0.5,
        },
      };

      const circular = analyzer.hasCircularDependency(mockResult, 'moduleA.ts');

      expect(circular).toHaveLength(1);
      expect(circular[0].cycle).toContain('moduleA.ts');
    });

    it('should return empty array when no circular dependencies exist', () => {
      const mockResult = {
        totalModules: 2,
        totalDependencies: 1,
        circularDependencies: [],
        orphanModules: [],
        moduleGraph: [],
        externalDependencies: [],
        metrics: {
          averageDependencies: 0.5,
          maxDependencies: 1,
          mostDependendOn: 'moduleB.ts',
          instabilityScore: 1,
        },
      };

      const circular = analyzer.hasCircularDependency(mockResult, 'moduleA.ts');

      expect(circular).toHaveLength(0);
    });
  });

  describe('getDependencyChain', () => {
    it('should find dependency chain between modules', () => {
      const mockResult = {
        totalModules: 3,
        totalDependencies: 2,
        circularDependencies: [],
        orphanModules: [],
        moduleGraph: [
          {
            source: 'A.ts',
            dependencies: ['B.ts'],
            dependents: [],
            isExternal: false,
          },
          {
            source: 'B.ts',
            dependencies: ['C.ts'],
            dependents: ['A.ts'],
            isExternal: false,
          },
          {
            source: 'C.ts',
            dependencies: [],
            dependents: ['B.ts'],
            isExternal: false,
          },
        ],
        externalDependencies: [],
        metrics: {
          averageDependencies: 0.67,
          maxDependencies: 1,
          mostDependendOn: 'C.ts',
          instabilityScore: 0.67,
        },
      };

      const chain = analyzer.getDependencyChain(mockResult, 'A.ts', 'C.ts');

      expect(chain).not.toBeNull();
      expect(chain).toEqual(['A.ts', 'B.ts', 'C.ts']);
    });

    it('should return null when no chain exists', () => {
      const mockResult = {
        totalModules: 2,
        totalDependencies: 0,
        circularDependencies: [],
        orphanModules: [],
        moduleGraph: [
          {
            source: 'A.ts',
            dependencies: [],
            dependents: [],
            isExternal: false,
          },
          {
            source: 'B.ts',
            dependencies: [],
            dependents: [],
            isExternal: false,
          },
        ],
        externalDependencies: [],
        metrics: {
          averageDependencies: 0,
          maxDependencies: 0,
          mostDependendOn: 'A.ts',
          instabilityScore: 0,
        },
      };

      const chain = analyzer.getDependencyChain(mockResult, 'A.ts', 'B.ts');

      expect(chain).toBeNull();
    });
  });
});
