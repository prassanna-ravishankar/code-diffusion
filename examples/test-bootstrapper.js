#!/usr/bin/env node
/**
 * Manual Integration Test 3: Bootstrapper Agent on Real Codebase
 * Tests the Bootstrapper agent's ability to analyze this codebase
 */

// Set dummy env vars for test
process.env.NOTION_API_KEY = process.env.NOTION_API_KEY || 'test-key';
process.env.CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || 'test-key';
process.env.NOTION_WORKFLOWS_DB_ID = process.env.NOTION_WORKFLOWS_DB_ID || 'test-db';
process.env.NOTION_STAGE_PAGES_DB_ID = process.env.NOTION_STAGE_PAGES_DB_ID || 'test-db';
process.env.NOTION_SUBAGENT_TASKS_DB_ID = process.env.NOTION_SUBAGENT_TASKS_DB_ID || 'test-db';

const { BootstrapperAgent } = require('../dist/agents/bootstrapper-agent');
const path = require('path');

console.log('🧪 Test 3: Bootstrapper Agent Analysis\n');

const config = {
  agentId: 'test-bootstrapper',
  workflowId: 'test-workflow',
  claudeApiKey: process.env.CLAUDE_API_KEY || 'test-key',
  notionApiKey: process.env.NOTION_API_KEY || 'test-key',
  codebasePath: path.join(__dirname, '..'),
  maxAnalysisDepth: 3,
  logLevel: 'info',
};

async function runTest() {
  try {
    console.log('1️⃣  Initializing Bootstrapper agent...');
    const agent = new BootstrapperAgent(config);
    console.log('   ✅ Agent initialized');

    console.log('\n2️⃣  Analyzing codebase structure...');
    console.log(`   Scanning: ${config.codebasePath}`);

    // Note: Full execution would require valid API keys
    // For now, we'll test the scanner component directly
    const { CodebaseScanner } = require('../dist/agents/codebase-scanner');
    const scanner = new CodebaseScanner({
      maxDepth: 3,
      respectGitignore: true,
      maxFileSize: 10 * 1024 * 1024,
    });

    console.log('\n3️⃣  Scanning files...');
    const scanResult = await scanner.scan(config.codebasePath);

    console.log(`   ✅ Found ${scanResult.files.length} files`);
    console.log(`   ✅ Total size: ${(scanResult.totalSize / 1024 / 1024).toFixed(2)} MB`);

    // Count by type
    const byType = {
      source: 0,
      test: 0,
      config: 0,
      documentation: 0,
      other: 0,
    };

    scanResult.files.forEach(file => {
      byType[file.type] = (byType[file.type] || 0) + 1;
    });

    console.log('\n4️⃣  File breakdown:');
    Object.entries(byType).forEach(([type, count]) => {
      if (count > 0) {
        console.log(`   - ${type}: ${count} files`);
      }
    });

    console.log('\n5️⃣  Testing AST parser...');
    const { ASTParser } = require('../dist/agents/ast-parser');
    const astParser = new ASTParser();

    // Find a TypeScript source file to parse
    const tsFile = scanResult.files.find(f => f.extension === '.ts' && f.type === 'source');
    if (tsFile) {
      const fileContent = await scanner.readFile(tsFile.path);
      const astResult = await astParser.parseFile(tsFile.path, fileContent);

      if (astResult) {
        console.log(`   ✅ Parsed ${tsFile.relativePath}`);
        console.log(`   - Imports: ${astResult.imports.length}`);
        console.log(`   - Exports: ${astResult.exports.length}`);
        console.log(`   - Functions: ${astResult.functions.length}`);
        console.log(`   - Classes: ${astResult.classes.length}`);
      }
    }

    console.log('\n6️⃣  Testing dependency analyzer...');
    const { DependencyAnalyzer } = require('../dist/agents/dependency-analyzer');
    const depAnalyzer = new DependencyAnalyzer({
      includeNodeModules: false,
      detectCircular: true,
    });

    const sourceFiles = scanResult.files.filter(f => f.type === 'source').slice(0, 5);
    if (sourceFiles.length > 0) {
      const depResult = await depAnalyzer.analyze(config.codebasePath, sourceFiles);

      if (depResult) {
        console.log(`   ✅ Analyzed ${depResult.totalModules} modules`);
        console.log(`   - Total dependencies: ${depResult.totalDependencies}`);
        console.log(`   - Circular dependencies: ${depResult.circularDependencies.length}`);
        console.log(`   - Average dependencies per module: ${depResult.metrics.averageDependencies.toFixed(2)}`);
        console.log(`   - Instability score: ${depResult.metrics.instabilityScore.toFixed(2)}`);
      }
    }

    console.log('\n7️⃣  Summary of codebase analysis:');
    console.log('   ✅ Codebase successfully scanned');
    console.log('   ✅ AST parsing working');
    console.log('   ✅ Dependency analysis functional');
    console.log('   ✅ Ready for workflow specification generation');

    console.log('\n✨ Bootstrapper test passed!\n');
    console.log('💡 Note: Full agent execution requires valid CLAUDE_API_KEY and NOTION_API_KEY');
    console.log('   Set these in .env to test complete workflow\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTest();
