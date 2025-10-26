/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import {
  AgentFlowCoordinator,
  type BootstrapperOutput,
  type ImplementerOutput,
} from '../src/orchestration/agent-flow-coordinator';
import { NotionCRUDService } from '../src/services/notion-crud.service';
import { AgentSpawner } from '../src/orchestration/agent-spawner';

// Mock dependencies
jest.mock('../src/services/notion-crud.service');
jest.mock('../src/orchestration/agent-spawner');

describe('AgentFlowCoordinator', () => {
  let coordinator: AgentFlowCoordinator;
  let mockNotionService: jest.Mocked<NotionCRUDService>;
  let mockAgentSpawner: jest.Mocked<AgentSpawner>;

  const testConfig = {
    notionApiKey: 'test-notion-key',
    claudeApiKey: 'test-claude-key',
    databaseIds: {
      workflowsDbId: 'workflows-db',
      stagePagesDbId: 'stage-pages-db',
      subagentTasksDbId: 'tasks-db',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    coordinator = new AgentFlowCoordinator(testConfig);

    // Get mocked instances
    mockNotionService = (coordinator as any).notionService;
    mockAgentSpawner = (coordinator as any).agentSpawner;

    // Setup default mock implementations
    mockNotionService.updateWorkflowStatus = jest.fn().mockResolvedValue(undefined);
    mockAgentSpawner.spawnAgent = jest.fn();
    mockAgentSpawner.shutdown = jest.fn().mockResolvedValue(undefined);
  });

  describe('startWorkflow', () => {
    it('should initialize workflow and spawn bootstrapper', async () => {
      const workflowId = 'test-workflow-1';

      await coordinator.startWorkflow(workflowId);

      // Verify Notion was updated
      expect(mockNotionService.updateWorkflowStatus).toHaveBeenCalledWith(workflowId, 'pending');
      expect(mockNotionService.updateWorkflowStatus).toHaveBeenCalledWith(
        workflowId,
        'bootstrapping'
      );

      // Verify bootstrapper was spawned
      expect(mockAgentSpawner.spawnAgent).toHaveBeenCalledWith({
        type: 'bootstrapper',
        workflowId,
        config: {
          skills: ['codebase_analysis', 'architecture_detection'],
          mcps: ['codebase_search', 'file_operations'],
        },
      });

      // Verify context was created
      const context = coordinator.getWorkflowContext(workflowId);
      expect(context).not.toBeNull();
      expect(context!.currentStage).toBe('bootstrapping');
    });
  });

  describe('handleBootstrapperCompletion', () => {
    it('should transition to planning after successful bootstrapper', async () => {
      const workflowId = 'test-workflow-2';
      await coordinator.startWorkflow(workflowId);

      const bootstrapperOutput: BootstrapperOutput = {
        codebaseAnalysis: { languages: ['TypeScript'], frameworks: ['React'] },
        workflowSpec: { stages: ['bootstrap', 'implement'] },
        suggestedApproach: 'TDD approach',
        estimatedComplexity: 'medium',
      };

      await coordinator.handleBootstrapperCompletion(workflowId, bootstrapperOutput);

      // Verify output was stored
      const context = coordinator.getWorkflowContext(workflowId);
      expect(context!.bootstrapperOutput).toEqual(bootstrapperOutput);

      // Verify transitioned to implementing (skipping planner in MVP)
      expect(context!.currentStage).toBe('implementing');
      expect(mockNotionService.updateWorkflowStatus).toHaveBeenCalledWith(
        workflowId,
        'implementing'
      );
    });

    it('should handle invalid bootstrapper output', async () => {
      const workflowId = 'test-workflow-3';
      await coordinator.startWorkflow(workflowId);

      const invalidOutput = {
        codebaseAnalysis: {},
        // Missing required fields
      } as BootstrapperOutput;

      await coordinator.handleBootstrapperCompletion(workflowId, invalidOutput);

      // Verify workflow was blocked
      const context = coordinator.getWorkflowContext(workflowId);
      expect(context!.currentStage).toBe('blocked');
      expect(mockNotionService.updateWorkflowStatus).toHaveBeenCalledWith(workflowId, 'blocked');
    });
  });

  describe('handleImplementerCompletion', () => {
    it('should complete workflow after successful implementation', async () => {
      const workflowId = 'test-workflow-4';
      await coordinator.startWorkflow(workflowId);

      const bootstrapperOutput: BootstrapperOutput = {
        codebaseAnalysis: {},
        workflowSpec: {},
        suggestedApproach: 'test',
        estimatedComplexity: 'low',
      };
      await coordinator.handleBootstrapperCompletion(workflowId, bootstrapperOutput);

      const implementerOutput: ImplementerOutput = {
        filesModified: ['src/feature.ts'],
        testsPassed: true,
        summary: 'Implementation complete',
      };

      await coordinator.handleImplementerCompletion(workflowId, implementerOutput);

      // Verify workflow completed
      const context = coordinator.getWorkflowContext(workflowId);
      expect(context!.currentStage).toBe('complete');
      expect(context!.implementerOutput).toEqual(implementerOutput);
      expect(mockNotionService.updateWorkflowStatus).toHaveBeenCalledWith(workflowId, 'complete');
    });

    it('should block workflow if tests failed', async () => {
      const workflowId = 'test-workflow-5';
      await coordinator.startWorkflow(workflowId);

      const bootstrapperOutput: BootstrapperOutput = {
        codebaseAnalysis: {},
        workflowSpec: {},
        suggestedApproach: 'test',
        estimatedComplexity: 'low',
      };
      await coordinator.handleBootstrapperCompletion(workflowId, bootstrapperOutput);

      const implementerOutput: ImplementerOutput = {
        filesModified: ['src/feature.ts'],
        testsPassed: false,
        summary: 'Tests failed',
      };

      await coordinator.handleImplementerCompletion(workflowId, implementerOutput);

      // Verify workflow was blocked
      const context = coordinator.getWorkflowContext(workflowId);
      expect(context!.currentStage).toBe('blocked');
    });
  });

  describe('retryWorkflow', () => {
    it('should retry blocked workflow from specified stage', async () => {
      const workflowId = 'test-workflow-6';
      await coordinator.startWorkflow(workflowId);

      // Simulate failure
      const invalidOutput = {} as BootstrapperOutput;
      await coordinator.handleBootstrapperCompletion(workflowId, invalidOutput);

      // Verify blocked
      expect(coordinator.getWorkflowContext(workflowId)!.currentStage).toBe('blocked');

      // Reset mock to track new calls
      mockAgentSpawner.spawnAgent.mockClear();

      // Retry
      await coordinator.retryWorkflow(workflowId, 'bootstrapping');

      // Verify retry spawned new agent
      expect(mockAgentSpawner.spawnAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'bootstrapper',
          workflowId,
        })
      );

      // Verify stage updated
      expect(coordinator.getWorkflowContext(workflowId)!.currentStage).toBe('bootstrapping');
    });

    it('should throw error for non-blocked workflow', async () => {
      const workflowId = 'test-workflow-7';
      await coordinator.startWorkflow(workflowId);

      // Try to retry active workflow
      await expect(coordinator.retryWorkflow(workflowId, 'bootstrapping')).rejects.toThrow(
        'is not blocked'
      );
    });

    it('should throw error for non-existent workflow', async () => {
      await expect(coordinator.retryWorkflow('non-existent', 'bootstrapping')).rejects.toThrow(
        'not found'
      );
    });
  });

  describe('getActiveWorkflows', () => {
    it('should return only active workflows', async () => {
      await coordinator.startWorkflow('workflow-1');
      await coordinator.startWorkflow('workflow-2');

      // Complete one workflow
      const output: BootstrapperOutput = {
        codebaseAnalysis: {},
        workflowSpec: {},
        suggestedApproach: 'test',
        estimatedComplexity: 'low',
      };
      await coordinator.handleBootstrapperCompletion('workflow-1', output);
      await coordinator.handleImplementerCompletion('workflow-1', {
        filesModified: [],
        testsPassed: true,
        summary: 'done',
      });

      const activeWorkflows = coordinator.getActiveWorkflows();

      expect(activeWorkflows).toHaveLength(1);
      expect(activeWorkflows).toContain('workflow-2');
      expect(activeWorkflows).not.toContain('workflow-1');
    });
  });

  describe('cleanupWorkflow', () => {
    it('should remove workflow from tracking', async () => {
      const workflowId = 'test-workflow-8';
      await coordinator.startWorkflow(workflowId);

      expect(coordinator.getWorkflowContext(workflowId)).not.toBeNull();

      coordinator.cleanupWorkflow(workflowId);

      expect(coordinator.getWorkflowContext(workflowId)).toBeNull();
    });
  });

  describe('getStatistics', () => {
    it('should return accurate statistics', async () => {
      await coordinator.startWorkflow('workflow-1');
      await coordinator.startWorkflow('workflow-2');

      const stats = coordinator.getStatistics();

      expect(stats.activeWorkflows).toBeGreaterThan(0);
      expect(stats.stateMachineStats.totalWorkflows).toBe(2);
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await coordinator.shutdown();

      expect(mockAgentSpawner.shutdown).toHaveBeenCalled();
    });
  });
});
