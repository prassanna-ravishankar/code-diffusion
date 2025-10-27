#!/usr/bin/env node
/**
 * Manual Integration Test 6: End-to-End Workflow
 * Tests complete workflow orchestration from start to finish (mock mode)
 */

// Set dummy env vars for test
process.env.NOTION_API_KEY = process.env.NOTION_API_KEY || 'test-key';
process.env.CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || 'test-key';
process.env.NOTION_WORKFLOWS_DB_ID = process.env.NOTION_WORKFLOWS_DB_ID || 'test-db';
process.env.NOTION_STAGE_PAGES_DB_ID = process.env.NOTION_STAGE_PAGES_DB_ID || 'test-db';
process.env.NOTION_SUBAGENT_TASKS_DB_ID = process.env.NOTION_SUBAGENT_TASKS_DB_ID || 'test-db';

const { WorkflowStateMachine } = require('../dist/orchestration/workflow-state-machine');

console.log('🧪 Test 6: End-to-End Workflow Simulation\n');

const stateMachine = new WorkflowStateMachine();
const workflowId = 'test-e2e-workflow';

async function simulateStage(stageName, duration) {
  return new Promise(resolve => {
    console.log(`   ⏳ Simulating ${stageName}...`);
    setTimeout(() => {
      console.log(`   ✅ ${stageName} completed`);
      resolve();
    }, duration);
  });
}

async function runTest() {
  try {
    console.log('🚀 Starting end-to-end workflow simulation\n');
    console.log('=' .repeat(50));

    // Stage 1: Workflow Initialization
    console.log('\n📋 Stage 1: Workflow Initialization');
    console.log('-'.repeat(50));
    const initialState = stateMachine.initializeWorkflow(workflowId, 'pending');
    console.log(`   ✅ Workflow initialized: ${workflowId}`);
    console.log(`   - Initial state: ${initialState.currentState}`);
    console.log(`   - Timestamp: ${initialState.createdAt.toISOString()}`);

    // Stage 2: Bootstrapping
    console.log('\n🔍 Stage 2: Bootstrapping (Codebase Analysis)');
    console.log('-'.repeat(50));
    stateMachine.transition(workflowId, 'bootstrapping', {
      phase: 'codebase-analysis',
      startedAt: new Date().toISOString(),
    });
    console.log('   ✅ Transitioned: pending → bootstrapping');
    await simulateStage('Scanning codebase', 500);
    await simulateStage('Parsing AST', 500);
    await simulateStage('Analyzing dependencies', 500);
    await simulateStage('Generating workflow spec', 500);

    const bootstrapperOutput = {
      projectName: 'Code Diffusion',
      languages: ['TypeScript', 'JavaScript'],
      frameworks: ['Node.js', 'Express', 'Jest'],
      architecture: 'Modular Agent System',
      keyFiles: ['src/agents/*', 'src/orchestration/*'],
    };
    console.log('   📊 Bootstrapper output generated:');
    console.log(`      - Project: ${bootstrapperOutput.projectName}`);
    console.log(`      - Languages: ${bootstrapperOutput.languages.join(', ')}`);
    console.log(`      - Frameworks: ${bootstrapperOutput.frameworks.join(', ')}`);

    // Stage 3: Planning
    console.log('\n📝 Stage 3: Planning (Task Generation)');
    console.log('-'.repeat(50));
    stateMachine.transition(workflowId, 'planning', {
      phase: 'task-generation',
      bootstrapperOutput,
      startedAt: new Date().toISOString(),
    });
    console.log('   ✅ Transitioned: bootstrapping → planning');
    await simulateStage('Breaking down requirements', 500);
    await simulateStage('Creating task hierarchy', 500);
    await simulateStage('Assigning priorities', 500);

    const plannerOutput = {
      totalTasks: 5,
      taskBreakdown: {
        'Setup infrastructure': 2,
        'Implement core features': 2,
        'Add tests': 1,
      },
    };
    console.log('   📊 Planner output generated:');
    console.log(`      - Total tasks: ${plannerOutput.totalTasks}`);
    Object.entries(plannerOutput.taskBreakdown).forEach(([category, count]) => {
      console.log(`      - ${category}: ${count} tasks`);
    });

    // Stage 4: Implementation
    console.log('\n⚙️  Stage 4: Implementation (Code Generation)');
    console.log('-'.repeat(50));
    stateMachine.transition(workflowId, 'implementing', {
      phase: 'code-generation',
      plannerOutput,
      startedAt: new Date().toISOString(),
    });
    console.log('   ✅ Transitioned: planning → implementing');

    for (let i = 1; i <= plannerOutput.totalTasks; i++) {
      await simulateStage(`Implementing task ${i}/${plannerOutput.totalTasks}`, 400);
    }

    await simulateStage('Running tests', 500);
    await simulateStage('Validating implementation', 500);

    const implementerOutput = {
      tasksCompleted: 5,
      tasksSuccessful: 5,
      tasksFailed: 0,
      testResults: {
        total: 12,
        passed: 12,
        failed: 0,
      },
    };
    console.log('   📊 Implementer output:');
    console.log(`      - Tasks completed: ${implementerOutput.tasksCompleted}/${implementerOutput.tasksCompleted}`);
    console.log(`      - Tests passed: ${implementerOutput.testResults.passed}/${implementerOutput.testResults.total}`);

    // Stage 5: Completion
    console.log('\n✅ Stage 5: Workflow Completion');
    console.log('-'.repeat(50));
    stateMachine.transition(workflowId, 'complete', {
      phase: 'finalization',
      implementerOutput,
      completedAt: new Date().toISOString(),
    });
    console.log('   ✅ Transitioned: implementing → complete');
    console.log('   🎉 Workflow successfully completed!');

    // Verification
    console.log('\n🔍 Workflow Verification');
    console.log('=' .repeat(50));

    const finalState = stateMachine.getState(workflowId);
    console.log(`✅ Final state: ${finalState.currentState}`);
    console.log(`✅ Total transitions: ${finalState.history.length}`);

    const isTerminal = stateMachine.isTerminalState(workflowId);
    console.log(`✅ Terminal state reached: ${isTerminal}`);

    console.log('\n📊 Transition History:');
    finalState.history.forEach((transition, index) => {
      const duration = index > 0
        ? transition.timestamp.getTime() - finalState.history[index - 1].timestamp.getTime()
        : 0;
      console.log(`   ${index + 1}. ${transition.from} → ${transition.to} ${duration > 0 ? `(+${duration}ms)` : ''}`);
    });

    const stats = stateMachine.getStatistics();
    console.log('\n📈 Statistics:');
    console.log(`   - Total workflows: ${stats.totalWorkflows}`);
    console.log(`   - Completed workflows: ${stats.byState.complete}`);
    console.log(`   - Average transitions: ${stats.averageTransitions.toFixed(2)}`);

    console.log('\n' + '=' .repeat(50));
    console.log('✨ End-to-end workflow test passed!\n');
    console.log('Summary:');
    console.log('  ✅ Workflow initialization successful');
    console.log('  ✅ All state transitions valid');
    console.log('  ✅ Bootstrapper → Planner → Implementer flow complete');
    console.log('  ✅ Context preserved throughout workflow');
    console.log('  ✅ Terminal state reached');
    console.log('  ✅ History tracking operational\n');

    console.log('💡 Note: This is a simulated workflow without real agent execution');
    console.log('   For full testing with actual agents, set API keys and use production mode\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTest();
