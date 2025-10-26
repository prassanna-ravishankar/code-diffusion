/**
 * AST Parser for Code Diffusion
 * Extracts code structure and patterns using Babel parser
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { parse, type ParserPlugin } from '@babel/parser';
import { createLogger } from '../utils/logger';
import type { ScannedFile } from './codebase-scanner';

const logger = createLogger('ASTParser');

export interface ASTAnalysisResult {
  imports: ImportInfo[];
  exports: ExportInfo[];
  functions: FunctionInfo[];
  classes: ClassInfo[];
  components: ComponentInfo[];
  hasJSX: boolean;
  hasTypeScript: boolean;
}

export interface ImportInfo {
  source: string;
  imports: string[];
  isDefault: boolean;
  isNamespace: boolean;
}

export interface ExportInfo {
  name: string;
  isDefault: boolean;
  type: 'function' | 'class' | 'const' | 'variable' | 'other';
}

export interface FunctionInfo {
  name: string;
  isAsync: boolean;
  isExported: boolean;
  parameters: string[];
}

export interface ClassInfo {
  name: string;
  isExported: boolean;
  methods: string[];
  superClass?: string;
}

export interface ComponentInfo {
  name: string;
  isExported: boolean;
  hasProps: boolean;
  hooks: string[];
}

export class ASTParser {
  /**
   * Parse a JavaScript/TypeScript file and extract structure
   */
  parseFile(file: ScannedFile, content: string): ASTAnalysisResult | null {
    try {
      const plugins = this.getParserPlugins(file.extension);

      const ast = parse(content, {
        sourceType: 'module',
        plugins,
        errorRecovery: true,
      });

      const result: ASTAnalysisResult = {
        imports: [],
        exports: [],
        functions: [],
        classes: [],
        components: [],
        hasJSX: plugins.includes('jsx'),
        hasTypeScript: plugins.includes('typescript'),
      };

      // Traverse the AST
      this.traverseAST(ast as any, result);

      logger.debug('AST analysis complete', {
        file: file.relativePath,
        imports: result.imports.length,
        exports: result.exports.length,
        functions: result.functions.length,
        classes: result.classes.length,
        components: result.components.length,
      });

      return result;
    } catch (error) {
      logger.warn('Failed to parse file', { file: file.relativePath, error });
      return null;
    }
  }

  /**
   * Get parser plugins based on file extension
   */
  private getParserPlugins(extension: string): ParserPlugin[] {
    const plugins: ParserPlugin[] = [];

    // TypeScript
    if (extension === '.ts' || extension === '.tsx') {
      plugins.push('typescript');
    }

    // JSX/TSX
    if (extension === '.jsx' || extension === '.tsx') {
      plugins.push('jsx');
    }

    // Common plugins
    plugins.push('decorators-legacy');
    plugins.push('classProperties');
    plugins.push('objectRestSpread');
    plugins.push('asyncGenerators');
    plugins.push('dynamicImport');
    plugins.push('optionalChaining');
    plugins.push('nullishCoalescingOperator');

    return plugins;
  }

  /**
   * Traverse AST and extract information
   */
  private traverseAST(ast: any, result: ASTAnalysisResult): void {
    if (!ast || !ast.program || !ast.program.body) {
      return;
    }

    for (const node of ast.program.body) {
      this.processNode(node, result);
    }
  }

  /**
   * Process an AST node
   */
  private processNode(node: any, result: ASTAnalysisResult): void {
    if (!node || !node.type) {
      return;
    }

    switch (node.type) {
      case 'ImportDeclaration':
        this.processImport(node, result);
        break;
      case 'ExportNamedDeclaration':
      case 'ExportDefaultDeclaration':
        this.processExport(node, result);
        break;
      case 'FunctionDeclaration':
        this.processFunction(node, result, false);
        break;
      case 'ClassDeclaration':
        this.processClass(node, result, false);
        break;
      case 'VariableDeclaration':
        this.processVariableDeclaration(node, result);
        break;
    }
  }

  /**
   * Process import declaration
   */
  private processImport(node: any, result: ASTAnalysisResult): void {
    const importInfo: ImportInfo = {
      source: node.source?.value || '',
      imports: [],
      isDefault: false,
      isNamespace: false,
    };

    if (node.specifiers) {
      for (const specifier of node.specifiers) {
        if (specifier.type === 'ImportDefaultSpecifier') {
          importInfo.isDefault = true;
          importInfo.imports.push(specifier.local?.name || 'default');
        } else if (specifier.type === 'ImportNamespaceSpecifier') {
          importInfo.isNamespace = true;
          importInfo.imports.push(specifier.local?.name || '*');
        } else if (specifier.type === 'ImportSpecifier') {
          importInfo.imports.push(specifier.imported?.name || specifier.local?.name || '');
        }
      }
    }

    result.imports.push(importInfo);
  }

  /**
   * Process export declaration
   */
  private processExport(node: any, result: ASTAnalysisResult): void {
    const isDefault = node.type === 'ExportDefaultDeclaration';

    if (node.declaration) {
      if (node.declaration.type === 'FunctionDeclaration') {
        this.processFunction(node.declaration, result, true);
      } else if (node.declaration.type === 'ClassDeclaration') {
        this.processClass(node.declaration, result, true);
      } else if (node.declaration.type === 'VariableDeclaration') {
        for (const declarator of node.declaration.declarations || []) {
          if (declarator.id?.name) {
            result.exports.push({
              name: declarator.id.name,
              isDefault,
              type: this.inferVariableType(declarator),
            });
          }
        }
      } else if (node.declaration.type === 'Identifier' && isDefault) {
        result.exports.push({
          name: node.declaration.name || 'default',
          isDefault: true,
          type: 'other',
        });
      }
    } else if (node.specifiers) {
      for (const specifier of node.specifiers) {
        result.exports.push({
          name: specifier.exported?.name || '',
          isDefault: false,
          type: 'other',
        });
      }
    }
  }

  /**
   * Process function declaration
   */
  private processFunction(node: any, result: ASTAnalysisResult, isExported: boolean): void {
    const functionInfo: FunctionInfo = {
      name: node.id?.name || 'anonymous',
      isAsync: node.async || false,
      isExported,
      parameters: (node.params || []).map((param: any) => param.name || param.id?.name || ''),
    };

    result.functions.push(functionInfo);

    // Check if this is a React component
    if (this.isReactComponent(node)) {
      result.components.push({
        name: functionInfo.name,
        isExported,
        hasProps: functionInfo.parameters.length > 0,
        hooks: this.extractReactHooks(node),
      });
    }
  }

  /**
   * Process class declaration
   */
  private processClass(node: any, result: ASTAnalysisResult, isExported: boolean): void {
    const classInfo: ClassInfo = {
      name: node.id?.name || 'Anonymous',
      isExported,
      methods: [],
      superClass: node.superClass?.name,
    };

    // Extract methods
    if (node.body?.body) {
      for (const member of node.body.body) {
        if (member.type === 'ClassMethod' || member.type === 'ClassProperty') {
          const methodName = member.key?.name || '';
          if (methodName) {
            classInfo.methods.push(methodName);
          }
        }
      }
    }

    result.classes.push(classInfo);

    // Check if this is a React component class
    if (this.isReactComponentClass(node)) {
      result.components.push({
        name: classInfo.name,
        isExported,
        hasProps: true,
        hooks: [],
      });
    }
  }

  /**
   * Process variable declaration
   */
  private processVariableDeclaration(node: any, result: ASTAnalysisResult): void {
    if (!node.declarations) return;

    for (const declarator of node.declarations) {
      // Check if this is a React component (arrow function or function expression)
      if (this.isReactComponentVariable(declarator)) {
        const componentInfo: ComponentInfo = {
          name: declarator.id?.name || 'Anonymous',
          isExported: false,
          hasProps: this.hasParameters(declarator.init),
          hooks: this.extractReactHooks(declarator.init),
        };
        result.components.push(componentInfo);
      }
    }
  }

  /**
   * Check if a function is a React component
   */
  private isReactComponent(node: any): boolean {
    const name = node.id?.name || '';
    // React components start with uppercase
    return name.length > 0 && name[0] === name[0].toUpperCase();
  }

  /**
   * Check if a class is a React component
   */
  private isReactComponentClass(node: any): boolean {
    const superClass = node.superClass?.name || '';
    return (
      superClass === 'Component' ||
      superClass === 'PureComponent' ||
      (node.superClass?.object?.name === 'React' &&
        (node.superClass?.property?.name === 'Component' ||
          node.superClass?.property?.name === 'PureComponent'))
    );
  }

  /**
   * Check if a variable declaration is a React component
   */
  private isReactComponentVariable(declarator: any): boolean {
    const name = declarator.id?.name || '';
    if (!name || name[0] !== name[0].toUpperCase()) {
      return false;
    }

    const init = declarator.init;
    return (
      init &&
      (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression') &&
      this.returnsJSX(init)
    );
  }

  /**
   * Check if a function returns JSX
   */
  private returnsJSX(node: any): boolean {
    if (!node.body) return false;

    // Simple heuristic: check if body contains JSXElement or JSXFragment
    const bodyStr = JSON.stringify(node.body);
    return bodyStr.includes('JSXElement') || bodyStr.includes('JSXFragment');
  }

  /**
   * Check if function has parameters
   */
  private hasParameters(node: any): boolean {
    return node && node.params && node.params.length > 0;
  }

  /**
   * Extract React hooks from function body
   */
  private extractReactHooks(node: any): string[] {
    const hooks: string[] = [];

    if (!node || !node.body) return hooks;

    // Simple pattern matching for common hooks
    const bodyStr = JSON.stringify(node.body);
    const hookPatterns = [
      'useState',
      'useEffect',
      'useContext',
      'useReducer',
      'useCallback',
      'useMemo',
      'useRef',
      'useImperativeHandle',
      'useLayoutEffect',
      'useDebugValue',
    ];

    for (const hook of hookPatterns) {
      if (bodyStr.includes(hook)) {
        hooks.push(hook);
      }
    }

    return hooks;
  }

  /**
   * Infer variable type from declarator
   */
  private inferVariableType(
    declarator: any
  ): 'function' | 'class' | 'const' | 'variable' | 'other' {
    if (!declarator.init) return 'variable';

    const initType = declarator.init.type;
    if (initType === 'ArrowFunctionExpression' || initType === 'FunctionExpression') {
      return 'function';
    }
    if (initType === 'ClassExpression') {
      return 'class';
    }

    return 'const';
  }

  /**
   * Batch parse multiple files
   */
  async parseFiles(
    files: ScannedFile[],
    contentGetter: (file: ScannedFile) => Promise<string | null>
  ): Promise<Map<string, ASTAnalysisResult>> {
    const results = new Map<string, ASTAnalysisResult>();

    for (const file of files) {
      // Only parse JS/TS files
      if (!['.js', '.jsx', '.ts', '.tsx'].includes(file.extension)) {
        continue;
      }

      const content = await contentGetter(file);
      if (!content) {
        continue;
      }

      const analysis = this.parseFile(file, content);
      if (analysis) {
        results.set(file.relativePath, analysis);
      }
    }

    logger.info('Batch AST parsing complete', {
      totalFiles: files.length,
      parsedFiles: results.size,
    });

    return results;
  }
}
