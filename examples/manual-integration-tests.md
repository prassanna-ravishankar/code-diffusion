# Manual Integration Tests for Code Diffusion

This document provides step-by-step manual integration tests to verify the end-to-end workflow is functioning correctly.

## Prerequisites

1. Set up environment variables in `.env`:
```bash
NOTION_API_KEY=your_notion_api_key
CLAUDE_API_KEY=your_claude_api_key
NOTION_WORKFLOWS_DB_ID=your_workflows_db_id
NOTION_STAGE_PAGES_DB_ID=your_stage_pages_db_id
NOTION_SUBAGENT_TASKS_DB_ID=your_subagent_tasks_db_id
```

2. Build the project:
```bash
npm run build
```

## Test 1: State Machine Transitions

**Purpose**: Verify the WorkflowStateMachine properly validates and tracks state transitions.

**Steps**:
```bash
node examples/test-state-machine.js
```

**Expected Output**:
- ✅ Workflow initialized in 'pending' state
- ✅ Successfully transitions: pending → bootstrapping → planning → implementing → complete
- ✅ Rejects invalid transitions (e.g., pending → complete)
- ✅ Allows blocked state from any stage
- ✅ History tracking shows all transitions with timestamps

**What this tests**: Core state machine logic and transition validation.

---

## Test 2: Agent Flow Coordinator

**Purpose**: Verify AgentFlowCoordinator properly manages workflow lifecycle.

**Steps**:
```bash
node examples/test-flow-coordinator.js
```

**Expected Output**:
- ✅ Workflow starts and enters bootstrapping stage
- ✅ Context is created and tracked
- ✅ State transitions are properly recorded
- ✅ Cleanup removes workflow from tracking

**What this tests**: Workflow coordination and context management.

---

## Test 3: Bootstrapper Agent on Real Codebase

**Purpose**: Run Bootstrapper agent on this codebase to verify it can analyze code.

**Steps**:
```bash
node examples/test-bootstrapper.js
```

**Expected Output**:
- ✅ Scans codebase and finds TypeScript files
- ✅ Parses AST for source files
- ✅ Analyzes dependencies using dependency-cruiser
- ✅ Generates workflow specification with:
  - Detected languages (TypeScript, JavaScript)
  - Detected frameworks (Node.js, Express, Jest)
  - Key files identified
  - Architecture assessment

**What this tests**: Bootstrapper's ability to analyze real codebases.

---

## Test 4: Implementer Agent Simulation

**Purpose**: Verify Implementer can generate and write code.

**Steps**:
```bash
node examples/test-implementer.js
```

**Expected Output**:
- ✅ Reads implementation tasks
- ✅ Generates code using Claude API (or uses provided implementation)
- ✅ Writes code to test directory
- ✅ Reports success/failure

**What this tests**: Implementer's code generation and file writing capabilities.

---

## Test 5: Error Handling and Retry

**Purpose**: Verify error handling properly categorizes errors and retries appropriately.

**Steps**:
```bash
node examples/test-error-handling.js
```

**Expected Output**:
- ✅ Recoverable errors (network, timeout) trigger retry with exponential backoff
- ✅ Non-recoverable errors block the workflow
- ✅ Max retries (3) is respected
- ✅ Error statistics are tracked correctly

**What this tests**: Error categorization and retry logic.

---

## Test 6: End-to-End Workflow

**Purpose**: Run a complete workflow from webhook to completion (without real Notion/Claude calls).

**Steps**:
```bash
node examples/test-e2e-workflow.js
```

**Expected Output**:
- ✅ Webhook triggers workflow start
- ✅ Workflow transitions through all stages:
  1. pending → bootstrapping
  2. bootstrapping → planning
  3. planning → implementing
  4. implementing → complete
- ✅ Each stage properly tracked in state machine
- ✅ Context preserved throughout workflow
- ✅ Final state is 'complete'

**What this tests**: Complete workflow orchestration from start to finish.

---

## Test 7: Webhook Simulation

**Purpose**: Verify webhook handler can process Notion webhook events.

**Steps**:
```bash
node examples/test-webhook-handler.js
```

**Expected Output**:
- ✅ Webhook payload is parsed correctly
- ✅ page_created event triggers workflow start
- ✅ page_updated event triggers status changes
- ✅ Invalid webhooks are rejected

**What this tests**: Webhook processing and event routing.

---

## Troubleshooting

### Tests fail with "API key not found"
- Ensure `.env` file exists with proper keys
- Check environment variables are loaded: `node -e "console.log(process.env.CLAUDE_API_KEY)"`

### Bootstrapper fails to scan codebase
- Verify codebase path is correct
- Check file permissions
- Ensure .gitignore is properly formatted

### State machine transitions fail
- Check that transitions follow valid paths:
  - pending → bootstrapping → planning → implementing → complete
  - Any state → blocked
  - blocked → any state (for retry)

### Tests pass but nothing happens
- Check logs in console output
- Verify mock services are properly initialized
- Ensure test files have execute permissions

---

## Next Steps

After verifying all manual tests pass:

1. **Production Testing**: Test with real Notion webhooks and Claude API calls
2. **Load Testing**: Test with multiple concurrent workflows
3. **Error Scenarios**: Test network failures, API rate limits, etc.
4. **Monitoring**: Set up logging aggregation and monitoring dashboards

---

## Running All Tests

To run all manual integration tests in sequence:

```bash
npm run test:integration:manual
```

This will execute all test scripts and provide a summary report.
