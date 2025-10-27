# Manual Integration Tests

This directory contains manual integration tests that let you verify the Code Diffusion system is working correctly.

## Two Types of Tests

### 1. Mock Tests (No API Keys Required)

These tests validate the system logic without making real API calls:

- `test-state-machine.js` - State transition validation
- `test-flow-coordinator.js` - Workflow coordination logic
- `test-bootstrapper.js` - Codebase scanning structure
- `test-implementer.js` - Task processing structure
- `test-error-handling.js` - Error categorization and retry logic
- `test-e2e-workflow.js` - Complete workflow simulation
- `test-webhook-handler.js` - Webhook event processing

**Run mock tests:**
```bash
npm run build
node examples/test-state-machine.js
node examples/test-error-handling.js
node examples/test-e2e-workflow.js
```

### 2. Real Tests (API Keys Required)

These tests use real API keys to demonstrate actual system behavior:

- `test-real-notion.js` - Test Notion API integration and database access
- `test-real-bootstrapper.js` - Run AI codebase analysis with Claude
- `test-real-workflow.js` - Complete end-to-end workflow with monitoring

**Run real tests:**
```bash
# First, set up your .env file with real API keys
cp .env.example .env
# Edit .env and add your keys

# Build the project
npm run build

# Test in order:
node examples/test-real-notion.js        # Fastest - validates Notion setup
node examples/test-real-bootstrapper.js  # ~60s - validates Claude API
node examples/test-real-workflow.js      # ~2-5min - full integration
```

## Quick Start

### For Mock Testing (No Setup Required)

```bash
npm run build
node examples/test-state-machine.js
```

You should see:
```
✨ All state machine tests passed!
```

### For Real Testing (Requires Setup)

1. **Get Claude API Key**:
   - Go to https://console.anthropic.com
   - Create an API key
   - Add to `.env` as `CLAUDE_API_KEY`

2. **Set Up Notion**:
   - Go to https://www.notion.so/my-integrations
   - Create integration, copy token
   - Create 3 databases in Notion
   - Share databases with integration
   - Copy database IDs to `.env`

3. **Run Tests**:
   ```bash
   npm run build
   node examples/test-real-notion.js
   ```

## Expected Output

### Mock Tests
- Fast execution (< 1 second each)
- Validates logic and structure
- No external API calls

### Real Tests
- **test-real-notion.js**: Creates/reads/updates/deletes test data in Notion (~10s)
- **test-real-bootstrapper.js**: Analyzes codebase with Claude AI (~60s)
- **test-real-workflow.js**: Monitors complete workflow execution (~2-5min)

## Troubleshooting

### Mock Tests Fail
- Run `npm run build` first
- Check that dist/ folder exists
- Verify Node.js version >= 18

### Real Tests Fail
- **401 Unauthorized**: Check API key validity
- **404 Not Found**: Verify database IDs and sharing
- **Network Errors**: Check internet connection
- **Timeout**: Claude API may be slow, increase timeout

## Documentation

See `manual-integration-tests.md` for detailed documentation of each test.

## Development Workflow

When developing new features:

1. Run mock tests to validate logic: `node examples/test-*.js`
2. Run unit tests: `npm test`
3. Run real tests to validate integration: `node examples/test-real-*.js`
4. Monitor workflow in Notion UI

## CI/CD Integration

Mock tests can run in CI/CD without API keys:

```yaml
# .github/workflows/test.yml
- name: Run mock integration tests
  run: |
    npm run build
    node examples/test-state-machine.js
    node examples/test-error-handling.js
    node examples/test-e2e-workflow.js
```

Real tests should only run with secrets configured:

```yaml
- name: Run real integration tests
  env:
    CLAUDE_API_KEY: ${{ secrets.CLAUDE_API_KEY }}
    NOTION_API_KEY: ${{ secrets.NOTION_API_KEY }}
    # ... other secrets
  run: node examples/test-real-notion.js
```
