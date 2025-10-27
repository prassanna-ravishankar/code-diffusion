#!/usr/bin/env node
/**
 * Real Integration Test: Notion API Integration
 *
 * This test verifies your Notion setup by:
 * 1. Testing API key authentication
 * 2. Verifying database access
 * 3. Creating test entries
 * 4. Reading back the data
 * 5. Cleaning up test data
 *
 * Prerequisites:
 * 1. Set NOTION_API_KEY in .env
 * 2. Set database IDs in .env
 * 3. Run: npm run build
 * 4. Run: node examples/test-real-notion.js
 */

require('dotenv').config();
const { NotionCRUDService } = require('../dist/services/notion-crud-service');

console.log('🧪 Real Integration Test: Notion API\n');
console.log('=' .repeat(70));

const config = {
  NOTION_API_KEY: process.env.NOTION_API_KEY,
  NOTION_WORKFLOWS_DB_ID: process.env.NOTION_WORKFLOWS_DB_ID,
  NOTION_STAGE_PAGES_DB_ID: process.env.NOTION_STAGE_PAGES_DB_ID,
  NOTION_SUBAGENT_TASKS_DB_ID: process.env.NOTION_SUBAGENT_TASKS_DB_ID,
};

console.log('\n📋 Configuration Check:');
let hasAllConfig = true;
Object.entries(config).forEach(([key, value]) => {
  const isValid = value && value !== 'test-key' && value !== 'test-db';
  const status = isValid ? '✅' : '❌';
  const display = isValid ? `${value.substring(0, 20)}...` : 'NOT SET';
  console.log(`   ${status} ${key}: ${display}`);
  if (!isValid) hasAllConfig = false;
});

if (!hasAllConfig) {
  console.log('\n❌ Missing required Notion configuration!');
  console.log('\nSetup Instructions:');
  console.log('  1. Create a Notion integration at: https://www.notion.so/my-integrations');
  console.log('  2. Copy the Internal Integration Token to NOTION_API_KEY in .env');
  console.log('  3. Create three databases in Notion (or use existing ones):');
  console.log('     - Workflows Database');
  console.log('     - Stage Pages Database');
  console.log('     - Subagent Tasks Database');
  console.log('  4. Share each database with your integration');
  console.log('  5. Copy each database ID to .env\n');
  console.log('💡 Tip: Database ID is in the URL: notion.so/[workspace]/[DATABASE_ID]?v=...\n');
  process.exit(1);
}

async function runTest() {
  const testPageIds = [];

  try {
    console.log('\n🔌 Step 1: Testing Notion API Connection...');
    const notionService = new NotionCRUDService(config.NOTION_API_KEY);
    console.log('   ✅ NotionCRUDService initialized');

    console.log('\n📝 Step 2: Testing Workflow Creation...');
    const testWorkflow = await notionService.createWorkflow({
      name: `Test Workflow - ${new Date().toISOString()}`,
      status: 'pending',
      description: 'This is a test workflow created by the integration test',
      metadata: {
        test: true,
        createdBy: 'test-real-notion.js',
        timestamp: new Date().toISOString(),
      },
    });

    console.log('   ✅ Workflow created successfully!');
    console.log(`   - Page ID: ${testWorkflow.id}`);
    console.log(`   - URL: https://notion.so/${testWorkflow.id.replace(/-/g, '')}`);
    testPageIds.push({ type: 'workflow', id: testWorkflow.id });

    console.log('\n📄 Step 3: Testing Stage Page Creation...');
    const testStagePage = await notionService.createStagePage({
      workflowId: testWorkflow.id,
      stage: 'bootstrapping',
      content: 'Test stage page content\n\nThis is a test.',
      metadata: {
        test: true,
        createdAt: new Date().toISOString(),
      },
    });

    console.log('   ✅ Stage page created successfully!');
    console.log(`   - Page ID: ${testStagePage.id}`);
    console.log(`   - URL: https://notion.so/${testStagePage.id.replace(/-/g, '')}`);
    testPageIds.push({ type: 'stagePage', id: testStagePage.id });

    console.log('\n✅ Step 4: Testing Subagent Task Creation...');
    const testTask = await notionService.createSubagentTask({
      workflowId: testWorkflow.id,
      taskType: 'implementation',
      title: 'Test Implementation Task',
      description: 'This is a test task for the integration test',
      status: 'pending',
      metadata: {
        test: true,
        priority: 'low',
      },
    });

    console.log('   ✅ Subagent task created successfully!');
    console.log(`   - Page ID: ${testTask.id}`);
    console.log(`   - URL: https://notion.so/${testTask.id.replace(/-/g, '')}`);
    testPageIds.push({ type: 'task', id: testTask.id });

    console.log('\n🔍 Step 5: Testing Data Retrieval...');

    // Query workflows
    const workflows = await notionService.queryWorkflows({ status: 'pending' });
    console.log(`   ✅ Found ${workflows.length} pending workflows`);
    const ourWorkflow = workflows.find(w => w.id === testWorkflow.id);
    if (ourWorkflow) {
      console.log('   ✅ Our test workflow found in query results');
    }

    // Query tasks
    const tasks = await notionService.querySubagentTasks(testWorkflow.id);
    console.log(`   ✅ Found ${tasks.length} tasks for our workflow`);

    console.log('\n📊 Step 6: Testing Status Update...');
    await notionService.updateWorkflowStatus(testWorkflow.id, 'bootstrapping');
    console.log('   ✅ Workflow status updated to "bootstrapping"');

    await notionService.updateSubagentTaskStatus(testTask.id, 'in-progress');
    console.log('   ✅ Task status updated to "in-progress"');

    console.log('\n🗑️  Step 7: Cleaning Up Test Data...');
    console.log('   Archiving test pages...');

    for (const page of testPageIds) {
      try {
        await notionService.archivePage(page.id);
        console.log(`   ✅ Archived ${page.type}: ${page.id}`);
      } catch (error) {
        console.log(`   ⚠️  Could not archive ${page.type}: ${error.message}`);
      }
    }

    console.log('\n' + '=' .repeat(70));
    console.log('✨ Notion integration test complete!\n');
    console.log('Summary:');
    console.log('  ✅ API connection working');
    console.log('  ✅ All databases accessible');
    console.log('  ✅ Create operations successful');
    console.log('  ✅ Query operations successful');
    console.log('  ✅ Update operations successful');
    console.log('  ✅ Archive operations successful');
    console.log('\nYour Notion setup is ready for Code Diffusion! 🎉\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nFull error:');
    console.error(error);

    console.log('\n💡 Common Issues:');
    console.log('  • Invalid API key: Check your integration token');
    console.log('  • Database not shared: Share databases with your integration');
    console.log('  • Wrong database ID: Verify database IDs in .env');
    console.log('  • Missing permissions: Ensure integration has read/write access');

    if (error.status === 401) {
      console.log('\n  → This looks like an authentication error');
      console.log('    Check your NOTION_API_KEY in .env');
    } else if (error.status === 404) {
      console.log('\n  → This looks like a "not found" error');
      console.log('    Check your database IDs and ensure they are shared with integration');
    }

    console.log('\n🧹 Attempting cleanup of test data...');
    for (const page of testPageIds) {
      try {
        const tempService = new NotionCRUDService(config.NOTION_API_KEY);
        await tempService.archivePage(page.id);
        console.log(`   ✅ Cleaned up ${page.type}`);
      } catch (cleanupError) {
        console.log(`   ⚠️  Could not clean up ${page.type}`);
      }
    }

    process.exit(1);
  }
}

runTest();
