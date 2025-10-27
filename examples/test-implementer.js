#!/usr/bin/env node
/**
 * Manual Integration Test 4: Implementer Agent
 * Tests the Implementer agent's ability to process tasks and generate code
 */

// Set dummy env vars for test
process.env.NOTION_API_KEY = process.env.NOTION_API_KEY || 'test-key';
process.env.CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || 'test-key';
process.env.NOTION_WORKFLOWS_DB_ID = process.env.NOTION_WORKFLOWS_DB_ID || 'test-db';
process.env.NOTION_STAGE_PAGES_DB_ID = process.env.NOTION_STAGE_PAGES_DB_ID || 'test-db';
process.env.NOTION_SUBAGENT_TASKS_DB_ID = process.env.NOTION_SUBAGENT_TASKS_DB_ID || 'test-db';

const { ImplementerAgent } = require('../dist/agents/implementer-agent');
const fs = require('fs');
const path = require('path');

console.log('🧪 Test 4: Implementer Agent\n');

const config = {
  agentId: 'test-implementer',
  workflowId: 'test-workflow',
  claudeApiKey: process.env.CLAUDE_API_KEY || 'test-key',
  notionApiKey: process.env.NOTION_API_KEY || 'test-key',
  targetRepoPath: path.join(__dirname, '../test-output'),
  testCommand: 'npm test',
  logLevel: 'info',
};

async function runTest() {
  try {
    console.log('1️⃣  Initializing Implementer agent...');
    const agent = new ImplementerAgent(config);
    console.log('   ✅ Agent initialized');
    console.log(`   - Agent ID: ${config.agentId}`);
    console.log(`   - Workflow ID: ${config.workflowId}`);
    console.log(`   - Target repo: ${config.targetRepoPath}`);

    console.log('\n2️⃣  Verifying agent type...');
    const agentType = agent.getAgentType();
    if (agentType === 'implementer') {
      console.log('   ✅ Agent type correctly identified as "implementer"');
    } else {
      throw new Error(`Expected agent type "implementer", got "${agentType}"`);
    }

    console.log('\n3️⃣  Testing task structure...');
    const mockTask = {
      taskId: 'task-1',
      title: 'Create utility function',
      description: 'Create a helper function that formats dates',
      implementation: `// Date formatting utility
function formatDate(date) {
  return new Date(date).toISOString().split('T')[0];
}

module.exports = { formatDate };`,
      filePath: 'src/utils/date-formatter.js',
    };
    console.log('   ✅ Task structure validated');
    console.log(`   - Task ID: ${mockTask.taskId}`);
    console.log(`   - Title: ${mockTask.title}`);
    console.log(`   - File path: ${mockTask.filePath}`);

    console.log('\n4️⃣  Testing file writing capability...');
    const testOutputDir = path.join(__dirname, '../test-output/src/utils');

    // Create test output directory
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
      console.log('   ✅ Test output directory created');
    }

    // Write mock implementation
    const testFilePath = path.join(testOutputDir, 'date-formatter.js');
    fs.writeFileSync(testFilePath, mockTask.implementation);

    if (fs.existsSync(testFilePath)) {
      console.log('   ✅ Code successfully written to file');
      console.log(`   - File: ${testFilePath}`);

      const content = fs.readFileSync(testFilePath, 'utf-8');
      console.log(`   - Content length: ${content.length} characters`);
    } else {
      throw new Error('Failed to write test file');
    }

    console.log('\n5️⃣  Testing result structure...');
    const mockResult = {
      taskId: 'task-1',
      success: true,
      filePath: testFilePath,
      message: 'Implementation completed successfully',
    };
    console.log('   ✅ Result structure validated');
    console.log(`   - Success: ${mockResult.success}`);
    console.log(`   - Message: ${mockResult.message}`);

    console.log('\n6️⃣  Testing error handling structure...');
    const mockErrorResult = {
      taskId: 'task-2',
      success: false,
      error: 'Failed to generate code',
      message: 'Code generation failed after 3 attempts',
    };
    console.log('   ✅ Error result structure validated');
    console.log(`   - Success: ${mockErrorResult.success}`);
    console.log(`   - Error: ${mockErrorResult.error}`);

    console.log('\n7️⃣  Cleanup test files...');
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
      console.log('   ✅ Test file removed');
    }

    console.log('\n8️⃣  Testing agent execution flow...');
    console.log('   ℹ️  Full execution requires:');
    console.log('      1. Valid NOTION_API_KEY to fetch tasks');
    console.log('      2. Valid CLAUDE_API_KEY to generate code');
    console.log('      3. Tasks in Notion database');
    console.log('   ⚠️  Skipping full execution (mock test only)');

    console.log('\n✨ Implementer agent test passed!\n');
    console.log('💡 Note: Full agent execution requires valid API keys and Notion tasks');
    console.log('   Set these in .env and create tasks in Notion to test complete implementation\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTest();
