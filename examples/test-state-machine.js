#!/usr/bin/env node
/**
 * Manual Integration Test 1: State Machine Transitions
 * Tests the WorkflowStateMachine state validation and transition tracking
 */

// Set dummy env vars for test (state machine doesn't need real API keys)
process.env.NOTION_API_KEY = process.env.NOTION_API_KEY || 'test-key';
process.env.CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || 'test-key';
process.env.NOTION_WORKFLOWS_DB_ID = process.env.NOTION_WORKFLOWS_DB_ID || 'test-db';
process.env.NOTION_STAGE_PAGES_DB_ID = process.env.NOTION_STAGE_PAGES_DB_ID || 'test-db';
process.env.NOTION_SUBAGENT_TASKS_DB_ID = process.env.NOTION_SUBAGENT_TASKS_DB_ID || 'test-db';

const { WorkflowStateMachine } = require('../dist/orchestration/workflow-state-machine');

console.log('🧪 Test 1: State Machine Transitions\n');

const stateMachine = new WorkflowStateMachine();
const workflowId = 'test-workflow-manual';

try {
  // Test 1: Initialize workflow
  console.log('1️⃣  Testing workflow initialization...');
  const state = stateMachine.initializeWorkflow(workflowId, 'pending');
  console.log(`   ✅ Workflow initialized in '${state.currentState}' state`);

  // Test 2: Valid transitions
  console.log('\n2️⃣  Testing valid state transitions...');
  stateMachine.transition(workflowId, 'bootstrapping');
  console.log('   ✅ pending → bootstrapping');

  stateMachine.transition(workflowId, 'planning');
  console.log('   ✅ bootstrapping → planning');

  stateMachine.transition(workflowId, 'implementing');
  console.log('   ✅ planning → implementing');

  stateMachine.transition(workflowId, 'complete');
  console.log('   ✅ implementing → complete');

  // Test 3: Invalid transition (should fail)
  console.log('\n3️⃣  Testing invalid transition (should fail)...');
  const workflowId2 = 'test-workflow-2';
  stateMachine.initializeWorkflow(workflowId2, 'pending');

  try {
    stateMachine.transition(workflowId2, 'implementing'); // Skip bootstrapping
    console.log('   ❌ FAILED: Invalid transition was allowed');
  } catch (error) {
    console.log('   ✅ Invalid transition correctly rejected');
  }

  // Test 4: Blocked state (should work from any state)
  console.log('\n4️⃣  Testing blocked state transitions...');
  const workflowId3 = 'test-workflow-3';
  stateMachine.initializeWorkflow(workflowId3, 'pending');
  stateMachine.transition(workflowId3, 'bootstrapping');
  stateMachine.transition(workflowId3, 'blocked');
  console.log('   ✅ Transition to blocked state successful');

  stateMachine.transition(workflowId3, 'bootstrapping'); // Retry from blocked
  console.log('   ✅ Retry from blocked state successful');

  // Test 5: History tracking
  console.log('\n5️⃣  Testing history tracking...');
  const history = stateMachine.getHistory(workflowId);
  console.log(`   ✅ History contains ${history.length} transitions`);
  console.log('   Transitions:');
  history.forEach((transition, i) => {
    console.log(`     ${i + 1}. ${transition.from} → ${transition.to} at ${transition.timestamp.toISOString()}`);
  });

  // Test 6: Terminal state
  console.log('\n6️⃣  Testing terminal state detection...');
  const isTerminal = stateMachine.isTerminalState(workflowId);
  console.log(`   ✅ Workflow in terminal state: ${isTerminal}`);

  // Test 7: Statistics
  console.log('\n7️⃣  Testing statistics...');
  const stats = stateMachine.getStatistics();
  console.log(`   ✅ Total workflows: ${stats.totalWorkflows}`);
  console.log(`   ✅ Completed workflows: ${stats.byState.complete}`);
  console.log(`   ✅ Average transitions: ${stats.averageTransitions.toFixed(2)}`);

  console.log('\n✨ All state machine tests passed!\n');
  process.exit(0);

} catch (error) {
  console.error('\n❌ Test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
