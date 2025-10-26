/**
 * Dependency Analyzer for Code Diffusion
 * Analyzes module dependencies using dependency-cruiser
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { cruise } from 'dependency-cruiser';
import type { ICruiseOptions, ICruiseResult } from 'dependency-cruiser';
import { createLogger } from '../utils/logger';
import type { ScannedFile } from './codebase-scanner';

const logger = createLogger('DependencyAnalyzer');

export interface DependencyAnalysisResult {
  totalModules: number;
  totalDependencies: number;
  circularDependencies: CircularDependency[];
  orphanModules: string[];
  moduleGraph: ModuleDependency[];
  externalDependencies: string[];
  metrics: DependencyMetrics;
}

export interface CircularDependency {
  cycle: string[];
  severity: 'warning' | 'error';
}

export interface ModuleDependency {
  source: string;
  dependencies: string[];
  dependents: string[];
  isExternal: boolean;
}

export interface DependencyMetrics {
  averageDependencies: number;
  maxDependencies: number;
  mostDependendOn: string;
  instabilityScore: number; // 0 = stable, 1 = unstable
}

export interface DependencyAnalyzerOptions {
  includeNodeModules?: boolean;
  maxDepth?: number;
  excludePatterns?: string[];
  detectCircular?: boolean;
}

export class DependencyAnalyzer {
  private options: Required<DependencyAnalyzerOptions>;

  constructor(options: DependencyAnalyzerOptions = {}) {
    this.options = {
      includeNodeModules: options.includeNodeModules ?? false,
      maxDepth: options.maxDepth ?? 10,
      excludePatterns: options.excludePatterns ?? ['node_modules', 'test', 'tests', '__tests__'],
      detectCircular: options.detectCircular ?? true,
    };
  }

  /**
   * Analyze dependencies for a codebase
   */
  async analyze(basePath: string, files: ScannedFile[]): Promise<DependencyAnalysisResult | null> {
    try {
      logger.info('Starting dependency analysis', {
        basePath,
        fileCount: files.length,
      });

      // Filter to only source files
      const sourceFiles = files.filter(
        (f) => f.type === 'source' && ['.ts', '.tsx', '.js', '.jsx'].includes(f.extension)
      );

      if (sourceFiles.length === 0) {
        logger.warn('No source files to analyze');
        return null;
      }

      // Build dependency-cruiser configuration
      const config = this.buildConfig();

      // Run dependency-cruiser
      const reporterOutput = await cruise(
        sourceFiles.map((f) => f.path),
        config
      );

      // Extract cruise result from reporter output
      if (typeof reporterOutput.output === 'string') {
        logger.error('Unexpected string output from dependency-cruiser');
        return null;
      }

      const cruiseResult = reporterOutput.output;

      // Parse results
      const result = this.parseResults(cruiseResult);

      logger.info('Dependency analysis complete', {
        totalModules: result.totalModules,
        circularDependencies: result.circularDependencies.length,
        orphanModules: result.orphanModules.length,
      });

      return result;
    } catch (error) {
      logger.error('Error during dependency analysis', { error });
      return null;
    }
  }

  /**
   * Build dependency-cruiser configuration
   */
  private buildConfig(): ICruiseOptions {
    return {
      ruleSet: {
        forbidden: [
          {
            name: 'no-circular',
            severity: 'warn',
            comment: 'Circular dependencies can lead to maintenance issues',
            from: {},
            to: {
              circular: true,
            },
          },
          {
            name: 'no-orphans',
            severity: 'info',
            comment: 'Orphan modules are not used anywhere',
            from: {
              orphan: true,
              pathNot: [
                '(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$', // dot files
                '\\.d\\.ts$', // TypeScript declaration files
                '(^|/)tsconfig\\.json$', // TypeScript config
                '(^|/)(babel|webpack)\\.config\\.(js|cjs|mjs|ts|json)$', // Build configs
              ],
            },
            to: {},
          },
        ],
      },
      doNotFollow: {
        path: this.options.excludePatterns.join('|'),
      },
      includeOnly: this.options.includeNodeModules ? '' : '^src',
      tsPreCompilationDeps: true,
      tsConfig: {
        fileName: './tsconfig.json',
      },
      enhancedResolveOptions: {
        exportsFields: ['exports'],
        conditionNames: ['import', 'require', 'node', 'default'],
      },
      reporterOptions: {
        dot: {
          collapsePattern: 'node_modules/[^/]+',
        },
      },
    };
  }

  /**
   * Parse dependency-cruiser results
   */
  private parseResults(cruiseResult: ICruiseResult): DependencyAnalysisResult {
    const modules = cruiseResult.modules || [];
    const summary = cruiseResult.summary || {};

    // Build module graph
    const moduleGraph: ModuleDependency[] = [];
    const dependentsMap = new Map<string, string[]>();

    // First pass: build basic graph
    for (const module of modules) {
      const source = module.source;
      const dependencies = (module.dependencies || [])
        .map((dep: any) => dep.resolved)
        .filter((dep: string) => dep && !dep.includes('node_modules'));

      moduleGraph.push({
        source,
        dependencies,
        dependents: [], // Will fill in second pass
        isExternal: module.coreModule || module.couldNotResolve || false,
      });

      // Track dependents
      for (const dep of dependencies) {
        if (!dependentsMap.has(dep)) {
          dependentsMap.set(dep, []);
        }
        dependentsMap.get(dep)!.push(source);
      }
    }

    // Second pass: fill in dependents
    for (const node of moduleGraph) {
      node.dependents = dependentsMap.get(node.source) || [];
    }

    // Extract circular dependencies
    const circularDependencies: CircularDependency[] = [];
    if (summary.violations) {
      for (const violation of summary.violations as any[]) {
        if (violation.rule?.name === 'no-circular' && violation.cycle) {
          circularDependencies.push({
            cycle: violation.cycle,
            severity: violation.rule.severity === 'error' ? 'error' : 'warning',
          });
        }
      }
    }

    // Extract orphan modules
    const orphanModules: string[] = [];
    if (summary.violations) {
      for (const violation of summary.violations as any[]) {
        if (violation.rule?.name === 'no-orphans' && violation.from) {
          orphanModules.push(violation.from);
        }
      }
    }

    // Extract external dependencies
    const externalDependencies = Array.from(
      new Set(
        modules
          .flatMap((m: any) => m.dependencies || [])
          .filter((dep: any) => dep.coreModule || dep.couldNotResolve)
          .map((dep: any) => dep.resolved)
      )
    ) as string[];

    // Calculate metrics
    const metrics = this.calculateMetrics(moduleGraph);

    // Count total dependencies
    const totalDependencies = modules.reduce(
      (sum: number, m: any) => sum + (m.dependencies?.length || 0),
      0
    );

    return {
      totalModules: modules.length,
      totalDependencies,
      circularDependencies,
      orphanModules,
      moduleGraph,
      externalDependencies,
      metrics,
    };
  }

  /**
   * Calculate dependency metrics
   */
  private calculateMetrics(moduleGraph: ModuleDependency[]): DependencyMetrics {
    if (moduleGraph.length === 0) {
      return {
        averageDependencies: 0,
        maxDependencies: 0,
        mostDependendOn: '',
        instabilityScore: 0,
      };
    }

    // Average dependencies per module
    const totalDeps = moduleGraph.reduce((sum, m) => sum + m.dependencies.length, 0);
    const averageDependencies = totalDeps / moduleGraph.length;

    // Max dependencies
    const maxDependencies = Math.max(...moduleGraph.map((m) => m.dependencies.length));

    // Most depended on module
    const mostDependendOn = moduleGraph.reduce((max, m) =>
      m.dependents.length > max.dependents.length ? m : max
    ).source;

    // Instability score (I = Ce / (Ce + Ca))
    // Ce = efferent coupling (dependencies), Ca = afferent coupling (dependents)
    const totalCe = moduleGraph.reduce((sum, m) => sum + m.dependencies.length, 0);
    const totalCa = moduleGraph.reduce((sum, m) => sum + m.dependents.length, 0);
    const instabilityScore = totalCe + totalCa > 0 ? totalCe / (totalCe + totalCa) : 0;

    return {
      averageDependencies: Math.round(averageDependencies * 100) / 100,
      maxDependencies,
      mostDependendOn,
      instabilityScore: Math.round(instabilityScore * 100) / 100,
    };
  }

  /**
   * Analyze a specific file's dependencies
   */
  async analyzeFile(filePath: string): Promise<ModuleDependency | null> {
    try {
      const config = this.buildConfig();
      const reporterOutput = await cruise([filePath], config);

      if (typeof reporterOutput.output === 'string') {
        logger.error('Unexpected string output from dependency-cruiser');
        return null;
      }

      const cruiseResult = reporterOutput.output;
      const modules = cruiseResult.modules || [];
      if (modules.length === 0) {
        return null;
      }

      const module = modules[0];
      if (!module) {
        return null;
      }

      return {
        source: module.source,
        dependencies: (module.dependencies || []).map((dep: any) => dep.resolved),
        dependents: [], // Cannot determine from single file analysis
        isExternal: module.coreModule || module.couldNotResolve || false,
      };
    } catch (error) {
      logger.error('Error analyzing file dependencies', { filePath, error });
      return null;
    }
  }

  /**
   * Check if there are circular dependencies between specific modules
   */
  hasCircularDependency(
    result: DependencyAnalysisResult,
    modulePath: string
  ): CircularDependency[] {
    return result.circularDependencies.filter((cd) => cd.cycle.includes(modulePath));
  }

  /**
   * Get dependency chain between two modules
   */
  getDependencyChain(result: DependencyAnalysisResult, from: string, to: string): string[] | null {
    const visited = new Set<string>();
    const path: string[] = [];

    const dfs = (current: string): boolean => {
      if (current === to) {
        path.push(current);
        return true;
      }

      if (visited.has(current)) {
        return false;
      }

      visited.add(current);
      path.push(current);

      const module = result.moduleGraph.find((m) => m.source === current);
      if (!module) {
        path.pop();
        return false;
      }

      for (const dep of module.dependencies) {
        if (dfs(dep)) {
          return true;
        }
      }

      path.pop();
      return false;
    };

    return dfs(from) ? path : null;
  }
}
