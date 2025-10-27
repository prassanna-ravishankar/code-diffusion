#!/usr/bin/env node
/**
 * Real Integration Test: Bootstrapper Agent with Real API Keys
 *
 * This test uses REAL API keys to analyze a codebase and generate
 * a workflow specification using Claude.
 *
 * Prerequisites:
 * 1. Set up .env file with real API keys
 * 2. Run: npm run build
 * 3. Run: node examples/test-real-bootstrapper.js
 */

require('dotenv').config();
const { BootstrapperAgent } = require('../dist/agents/bootstrapper-agent');
const path = require('path');
const fs = require('fs');

console.log('🧪 Real Integration Test: Bootstrapper Agent\n');
console.log('=' .repeat(70));

// Check for required API keys
const requiredKeys = {
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY,
  NOTION_API_KEY: process.env.NOTION_API_KEY,
};

console.log('\n📋 Environment Check:');
Object.entries(requiredKeys).forEach(([key, value]) => {
  const status = value && value !== 'test-key' ? '✅' : '❌';
  const display = value && value !== 'test-key'
    ? `${value.substring(0, 10)}...`
    : 'NOT SET';
  console.log(`   ${status} ${key}: ${display}`);
});

if (!requiredKeys.CLAUDE_API_KEY || requiredKeys.CLAUDE_API_KEY === 'test-key') {
  console.log('\n❌ CLAUDE_API_KEY or ANTHROPIC_API_KEY is required');
  console.log('   Set it in .env file and try again\n');
  process.exit(1);
}

if (!requiredKeys.NOTION_API_KEY || requiredKeys.NOTION_API_KEY === 'test-key') {
  console.log('\n⚠️  NOTION_API_KEY not set - will skip Notion integration');
}

async function runTest() {
  try {
    const workflowId = `real-test-${Date.now()}`;
    const codebasePath = path.join(__dirname, '..');

    console.log('\n📂 Target Codebase:');
    console.log(`   Path: ${codebasePath}`);
    console.log(`   Analyzing: Code Diffusion project`);

    console.log('\n🚀 Initializing Bootstrapper Agent...');
    const config = {
      agentId: `bootstrapper-real-${Date.now()}`,
      workflowId,
      claudeApiKey: requiredKeys.CLAUDE_API_KEY,
      notionApiKey: requiredKeys.NOTION_API_KEY || 'mock-key',
      codebasePath,
      maxAnalysisDepth: 2, // Limit depth for faster testing
      logLevel: 'info',
    };

    const agent = new BootstrapperAgent(config);
    console.log('   ✅ Agent initialized');
    console.log(`   - Workflow ID: ${workflowId}`);
    console.log(`   - Max depth: ${config.maxAnalysisDepth}`);

    console.log('\n🔍 Phase 1: Scanning Codebase...');
    console.log('   This will scan the directory structure...');

    // Import scanner directly to show progress
    const { CodebaseScanner } = require('../dist/agents/codebase-scanner');
    const scanner = new CodebaseScanner({
      maxDepth: config.maxAnalysisDepth,
      respectGitignore: true,
      maxFileSize: 10 * 1024 * 1024,
    });

    const scanResult = await scanner.scan(codebasePath);
    console.log(`   ✅ Scan complete!`);
    console.log(`   - Total files: ${scanResult.files.length}`);
    console.log(`   - Total size: ${(scanResult.totalSize / 1024 / 1024).toFixed(2)} MB`);

    // Show file breakdown
    const byType = {};
    scanResult.files.forEach(file => {
      byType[file.type] = (byType[file.type] || 0) + 1;
    });
    console.log('   - File types:');
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`     • ${type}: ${count} files`);
    });

    console.log('\n🤖 Phase 2: Running AI Analysis with Claude...');
    console.log('   This may take 30-60 seconds...');
    console.log('   Claude is analyzing the codebase structure...\n');

    const startTime = Date.now();

    // Execute the bootstrapper agent
    await agent.execute();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n   ✅ AI analysis complete! (${duration}s)`);

    console.log('\n📊 Phase 3: Reading Generated Workflow Specification...');

    // The agent saves output to .code-diffusion/workflows/
    const outputDir = path.join(codebasePath, '.code-diffusion', 'workflows', workflowId);
    const specFile = path.join(outputDir, 'workflow-spec.json');

    if (fs.existsSync(specFile)) {
      const spec = JSON.parse(fs.readFileSync(specFile, 'utf-8'));

      console.log('\n   ✅ Workflow specification generated!');
      console.log('\n   📝 Project Analysis:');
      console.log(`   - Project Name: ${spec.specification.projectName}`);
      console.log(`   - Languages: ${spec.specification.languages.join(', ')}`);
      console.log(`   - Frameworks: ${spec.specification.frameworks.join(', ')}`);
      console.log(`   - Architecture: ${spec.specification.architecture}`);
      console.log(`   - Key Files: ${spec.specification.keyFiles.length} identified`);

      if (spec.specification.keyFiles.length > 0) {
        console.log('\n   🔑 Key Files Identified:');
        spec.specification.keyFiles.slice(0, 5).forEach(file => {
          console.log(`      • ${file}`);
        });
        if (spec.specification.keyFiles.length > 5) {
          console.log(`      ... and ${spec.specification.keyFiles.length - 5} more`);
        }
      }

      console.log('\n   📋 Suggested Tasks:');
      if (spec.specification.suggestedTasks.length > 0) {
        spec.specification.suggestedTasks.slice(0, 3).forEach((task, i) => {
          console.log(`      ${i + 1}. ${task.title}`);
          console.log(`         ${task.description}`);
        });
        if (spec.specification.suggestedTasks.length > 3) {
          console.log(`      ... and ${spec.specification.suggestedTasks.length - 3} more tasks`);
        }
      } else {
        console.log('      (No tasks suggested)');
      }

      console.log('\n   💾 Output Files:');
      console.log(`      • Specification: ${specFile}`);
      console.log(`      • Directory: ${outputDir}`);

      // Show full spec in JSON format
      console.log('\n   📄 Full Specification (JSON):');
      console.log('   ' + '-'.repeat(66));
      console.log(JSON.stringify(spec, null, 2).split('\n').map(line => '   ' + line).join('\n'));
      console.log('   ' + '-'.repeat(66));

    } else {
      console.log('   ⚠️  Specification file not found at expected location');
      console.log(`      Expected: ${specFile}`);
      console.log('      Check agent logs for details');
    }

    console.log('\n' + '=' .repeat(70));
    console.log('✨ Real bootstrapper test complete!\n');
    console.log('Next Steps:');
    console.log('  1. Review the generated workflow specification above');
    console.log('  2. Check the output files in .code-diffusion/workflows/');
    console.log('  3. Use this workflow ID for testing Implementer agent');
    console.log(`  4. Workflow ID: ${workflowId}\n`);

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nFull error:');
    console.error(error);
    console.error('\nStack trace:');
    console.error(error.stack);
    process.exit(1);
  }
}

runTest();
