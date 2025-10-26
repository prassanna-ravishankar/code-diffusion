/* eslint-disable @typescript-eslint/no-non-null-assertion */
// @ts-nocheck - Disable type checking for test assertions

import { ImplementerAgent } from '../src/agents/implementer-agent';
import { NotionCRUDService } from '../services/notion-crud.service';
import * as fs from 'fs/promises';

// Mock dependencies
jest.mock('../src/services/notion-crud.service');
jest.mock('fs/promises');
jest.mock('child_process', () => ({
  exec: jest.fn((cmd, opts, callback) => {
    // Simulate successful command execution
    callback(null, { stdout: 'Tests passed', stderr: '' });
  }),
}));

// Mock Anthropic
const mockCreate = jest.fn().mockResolvedValue({
  content: [
    {
      type: 'text',
      text: '// Generated implementation\nfunction example() {\n  return "test";\n}',
    },
  ],
});

jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: mockCreate,
    },
  }));
});

describe('ImplementerAgent', () => {
  let agent: ImplementerAgent;
  let mockNotionService: jest.Mocked<NotionCRUDService>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create agent with test config
    agent = new ImplementerAgent({
      agentId: 'test-implementer',
      workflowId: 'test-workflow',
      claudeApiKey: 'test-key',
      notionApiKey: 'test-key',
      targetRepositoryPath: '/test/repo',
      testCommand: 'npm test',
      logLevel: 'error',
    });

    mockNotionService = (agent as any).notionService;
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(agent).toBeDefined();
      expect((agent as any).implementerConfig.targetRepositoryPath).toBe('/test/repo');
    });
  });

  describe('execute', () => {
    it('should execute implementation workflow', async () => {
      // Mock Notion responses
      mockNotionService.querySubagentTasks.mockResolvedValue([
        {
          id: 'task-1',
          properties: {
            Description: {
              type: 'rich_text',
              rich_text: [{ plain_text: 'Implement feature X' }],
            },
            'File Path': {
              type: 'rich_text',
              rich_text: [{ plain_text: 'src/feature.ts' }],
            },
            Implementation: {
              type: 'rich_text',
              rich_text: [{ plain_text: 'console.log("feature");' }],
            },
          },
        },
      ] as any);

      mockNotionService.updateSubagentTask.mockResolvedValue(undefined as any);
      mockNotionService.createStagePage.mockResolvedValue({} as any);
      mockNotionService.updateWorkflowStatus.mockResolvedValue(undefined as any);

      // Mock file system
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await agent.execute();

      expect(mockNotionService.querySubagentTasks).toHaveBeenCalledWith('test-workflow');
      expect(fs.writeFile).toHaveBeenCalled();
      expect(mockNotionService.createStagePage).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockNotionService.querySubagentTasks.mockRejectedValue(new Error('Notion error'));

      await expect(agent.execute()).rejects.toThrow('Notion error');
    });
  });

  describe('getAgentType', () => {
    it('should return correct agent type', () => {
      expect((agent as any).getAgentType()).toBe('ImplementerAgent');
    });
  });
});
