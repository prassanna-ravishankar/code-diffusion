#!/usr/bin/env node
/**
 * Real Integration Test: Complete End-to-End Workflow
 *
 * This test runs a REAL workflow using actual API keys:
 * 1. Creates a workflow in Notion
 * 2. Triggers Bootstrapper to analyze codebase
 * 3. Monitors workflow progress
 * 4. Shows real-time status updates
 *
 * Prerequisites:
 * 1. Set up .env file with ALL API keys and database IDs
 * 2. Notion databases must be created and configured
 * 3. Run: npm run build
 * 4. Run: node examples/test-real-workflow.js
 */

require('dotenv').config();
const { AgentFlowCoordinator } = require('../dist/orchestration/agent-flow-coordinator');
const { NotionCRUDService } = require('../dist/services/notion-crud-service');

console.log('🧪 Real Integration Test: Complete Workflow\n');
console.log('=' .repeat(70));

// Check for all required configuration
const requiredConfig = {
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY,
  NOTION_API_KEY: process.env.NOTION_API_KEY,
  NOTION_WORKFLOWS_DB_ID: process.env.NOTION_WORKFLOWS_DB_ID,
  NOTION_STAGE_PAGES_DB_ID: process.env.NOTION_STAGE_PAGES_DB_ID,
  NOTION_SUBAGENT_TASKS_DB_ID: process.env.NOTION_SUBAGENT_TASKS_DB_ID,
};

console.log('\n📋 Configuration Check:');
let allConfigured = true;
Object.entries(requiredConfig).forEach(([key, value]) => {
  const isValid = value && value !== 'test-key' && value !== 'test-db';
  const status = isValid ? '✅' : '❌';
  const display = isValid ? `${value.substring(0, 15)}...` : 'NOT SET';
  console.log(`   ${status} ${key}: ${display}`);
  if (!isValid) allConfigured = false;
});

if (!allConfigured) {
  console.log('\n❌ Missing required configuration!');
  console.log('\nTo run this test, you need:');
  console.log('  1. Create Notion databases (see docs/notion-setup.md)');
  console.log('  2. Set all environment variables in .env');
  console.log('  3. Ensure API keys are valid\n');
  console.log('💡 Tip: Run test-real-bootstrapper.js first for simpler testing\n');
  process.exit(1);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  try {
    const workflowId = `workflow-${Date.now()}`;

    console.log('\n🚀 Step 1: Initializing Services...');

    const coordinator = new AgentFlowCoordinator({
      notionApiKey: requiredConfig.NOTION_API_KEY,
      claudeApiKey: requiredConfig.CLAUDE_API_KEY,
      databaseIds: {
        workflows: requiredConfig.NOTION_WORKFLOWS_DB_ID,
        stagePages: requiredConfig.NOTION_STAGE_PAGES_DB_ID,
        subagentTasks: requiredConfig.NOTION_SUBAGENT_TASKS_DB_ID,
      },
    });

    const notionService = new NotionCRUDService(requiredConfig.NOTION_API_KEY);
    console.log('   ✅ Services initialized');

    console.log('\n📝 Step 2: Creating Workflow in Notion...');
    const workflowPage = await notionService.createWorkflow({
      name: `Test Workflow ${new Date().toISOString()}`,
      status: 'pending',
      description: 'Automated test workflow for Code Diffusion',
      metadata: {
        testRun: true,
        workflowId,
        startedAt: new Date().toISOString(),
      },
    });

    console.log('   ✅ Workflow created in Notion!');
    console.log(`   - Page ID: ${workflowPage.id}`);
    console.log(`   - Workflow ID: ${workflowId}`);
    console.log(`   - View in Notion: https://notion.so/${workflowPage.id.replace(/-/g, '')}`);

    console.log('\n🎬 Step 3: Starting Workflow...');
    console.log('   Triggering AgentFlowCoordinator...');

    // Start the workflow (this will spawn the bootstrapper)
    coordinator.startWorkflow(workflowId).catch(error => {
      console.error('   ⚠️  Workflow error:', error.message);
    });

    console.log('   ✅ Workflow started!');

    console.log('\n⏱️  Step 4: Monitoring Progress...');
    console.log('   Checking workflow status every 5 seconds...\n');

    let previousStatus = null;
    let checkCount = 0;
    const maxChecks = 60; // Monitor for up to 5 minutes

    while (checkCount < maxChecks) {
      await sleep(5000);
      checkCount++;

      try {
        // Get current workflow state
        const state = coordinator.getWorkflowState(workflowId);
        const context = coordinator.getWorkflowContext(workflowId);

        if (state) {
          const statusChanged = state.currentState !== previousStatus;

          if (statusChanged) {
            console.log(`   [${new Date().toISOString()}] State: ${previousStatus || 'unknown'} → ${state.currentState}`);
            previousStatus = state.currentState;

            // Show context if available
            if (context) {
              if (context.bootstrapperOutput) {
                console.log('      ✅ Bootstrapper completed');
                console.log(`         - Project: ${context.bootstrapperOutput.specification.projectName}`);
                console.log(`         - Languages: ${context.bootstrapperOutput.specification.languages.join(', ')}`);
              }
              if (context.implementerOutput) {
                console.log('      ✅ Implementer completed');
                console.log(`         - Tasks: ${context.implementerOutput.tasksCompleted}`);
              }
            }
          } else {
            // No change, just show we're still monitoring
            process.stdout.write('   .');
          }

          // Check if workflow is complete
          if (state.currentState === 'complete') {
            console.log('\n\n   🎉 Workflow completed successfully!');
            break;
          }

          if (state.currentState === 'blocked') {
            console.log('\n\n   ⚠️  Workflow is blocked');
            console.log('      Check logs for error details');
            break;
          }

        } else {
          console.log(`   [Check ${checkCount}] Waiting for workflow state...`);
        }

      } catch (error) {
        console.error(`\n   ⚠️  Error checking status: ${error.message}`);
      }
    }

    if (checkCount >= maxChecks) {
      console.log('\n\n   ⏰ Monitoring timeout reached (5 minutes)');
      console.log('      Workflow may still be running');
    }

    console.log('\n📊 Step 5: Final Statistics...');
    const stats = coordinator.getStatistics();
    console.log(`   - Active workflows: ${stats.activeWorkflows}`);
    console.log(`   - Completed workflows: ${stats.completedWorkflows}`);
    console.log(`   - Blocked workflows: ${stats.blockedWorkflows}`);

    const finalState = coordinator.getWorkflowState(workflowId);
    if (finalState) {
      console.log(`\n   Final State: ${finalState.currentState}`);
      console.log(`   Total Transitions: ${finalState.history.length}`);
      console.log('\n   Transition History:');
      finalState.history.forEach((t, i) => {
        const time = t.timestamp.toISOString().substring(11, 19);
        console.log(`      ${i + 1}. [${time}] ${t.from} → ${t.to}`);
      });
    }

    console.log('\n' + '=' .repeat(70));
    console.log('✨ Real workflow test complete!\n');
    console.log('Review the results:');
    console.log(`  1. Check Notion database: ${requiredConfig.NOTION_WORKFLOWS_DB_ID}`);
    console.log(`  2. View workflow page: https://notion.so/${workflowPage.id.replace(/-/g, '')}`);
    console.log('  3. Check .code-diffusion/workflows/ for generated files');
    console.log(`  4. Workflow ID: ${workflowId}\n`);

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nFull error:');
    console.error(error);
    console.error('\nStack trace:');
    console.error(error.stack);
    console.log('\n💡 Troubleshooting:');
    console.log('  - Verify Notion API key has correct permissions');
    console.log('  - Check database IDs are correct');
    console.log('  - Ensure Claude API key is valid');
    console.log('  - Review error message above for specific issues\n');
    process.exit(1);
  }
}

runTest();
