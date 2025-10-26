/**
 * Agent Flow Coordinator for Code Diffusion
 * Manages agent lifecycle and orchestrates data handoff between agents
 */

import { createLogger } from '../utils/logger';
import { WorkflowStateMachine } from './workflow-state-machine';
import { AgentSpawner } from './agent-spawner';
import { NotionCRUDService } from '../services/notion-crud.service';
import type { WorkflowStatus } from '../types/notion';

const logger = createLogger('AgentFlowCoordinator');

export interface WorkflowContext {
  workflowId: string;
  currentStage: WorkflowStatus;
  bootstrapperOutput?: BootstrapperOutput;
  plannerOutput?: PlannerOutput;
  implementerOutput?: ImplementerOutput;
  metadata: Record<string, unknown>;
}

export interface BootstrapperOutput {
  codebaseAnalysis: Record<string, unknown>;
  workflowSpec: Record<string, unknown>;
  suggestedApproach: string;
  estimatedComplexity: 'low' | 'medium' | 'high';
}

export interface PlannerOutput {
  tasks: Array<Record<string, unknown>>;
  dependencies: Record<string, string[]>;
  estimatedDuration: string;
}

export interface ImplementerOutput {
  filesModified: string[];
  testsPassed: boolean;
  summary: string;
}

export interface AgentFlowConfig {
  notionApiKey: string;
  claudeApiKey: string;
  databaseIds: {
    workflowsDbId: string;
    stagePagesDbId: string;
    subagentTasksDbId: string;
  };
}

/**
 * Agent Flow Coordinator
 * Orchestrates the complete workflow from Bootstrapper through Implementer
 */
export class AgentFlowCoordinator {
  private stateMachine: WorkflowStateMachine;
  private agentSpawner: AgentSpawner;
  private notionService: NotionCRUDService;
  private workflowContexts: Map<string, WorkflowContext> = new Map();

  constructor(config: AgentFlowConfig) {
    this.stateMachine = new WorkflowStateMachine();
    this.agentSpawner = new AgentSpawner();
    this.notionService = new NotionCRUDService(config.notionApiKey, config.databaseIds);

    logger.info('AgentFlowCoordinator initialized');
  }

  /**
   * Start a new workflow
   */
  async startWorkflow(workflowId: string): Promise<void> {
    logger.info('Starting workflow', { workflowId });

    // Initialize state machine
    this.stateMachine.initializeWorkflow(workflowId, 'pending');

    // Initialize workflow context
    const context: WorkflowContext = {
      workflowId,
      currentStage: 'pending',
      metadata: {
        startedAt: new Date().toISOString(),
      },
    };
    this.workflowContexts.set(workflowId, context);

    // Update Notion workflow status
    await this.notionService.updateWorkflowStatus(workflowId, 'pending');

    // Transition to bootstrapping and spawn agent
    await this.transitionToBootstrapping(workflowId);
  }

  /**
   * Transition workflow to bootstrapping stage
   */
  private async transitionToBootstrapping(
    workflowId: string,
    skipTransition = false
  ): Promise<void> {
    logger.info('Transitioning to bootstrapping', { workflowId });

    // Update state machine (unless we're retrying and already transitioned)
    if (!skipTransition) {
      this.stateMachine.transition(workflowId, 'bootstrapping', {
        transitionedAt: new Date().toISOString(),
      });
    }

    // Update context
    const context = this.workflowContexts.get(workflowId);
    if (context) {
      context.currentStage = 'bootstrapping';
      this.workflowContexts.set(workflowId, context);
    }

    // Update Notion
    await this.notionService.updateWorkflowStatus(workflowId, 'bootstrapping');

    // Spawn Bootstrapper agent
    this.agentSpawner.spawnAgent({
      type: 'bootstrapper',
      workflowId,
      config: {
        skills: ['codebase_analysis', 'architecture_detection'],
        mcps: ['codebase_search', 'file_operations'],
      },
    });

    logger.info('Bootstrapper agent spawned', { workflowId });
  }

  /**
   * Handle completion of Bootstrapper agent
   */
  async handleBootstrapperCompletion(
    workflowId: string,
    output: BootstrapperOutput
  ): Promise<void> {
    logger.info('Bootstrapper completed', { workflowId });

    // Validate output
    if (!this.validateBootstrapperOutput(output)) {
      await this.handleAgentFailure(workflowId, 'bootstrapper', 'Invalid bootstrapper output');
      return;
    }

    // Store output in context
    const context = this.workflowContexts.get(workflowId);
    if (context) {
      context.bootstrapperOutput = output;
      context.metadata['bootstrapperCompletedAt'] = new Date().toISOString();
      this.workflowContexts.set(workflowId, context);
    }

    // Transition to planning
    await this.transitionToPlanning(workflowId);
  }

  /**
   * Transition workflow to planning stage
   */
  private async transitionToPlanning(workflowId: string): Promise<void> {
    logger.info('Transitioning to planning', { workflowId });

    // Update state machine
    this.stateMachine.transition(workflowId, 'planning', {
      transitionedAt: new Date().toISOString(),
    });

    // Update context
    const context = this.workflowContexts.get(workflowId);
    if (context) {
      context.currentStage = 'planning';
      this.workflowContexts.set(workflowId, context);
    }

    // Update Notion
    await this.notionService.updateWorkflowStatus(workflowId, 'planning');

    // For MVP, skip planner and go directly to implementing
    // In full version, would spawn Planner agent here
    logger.info('Skipping planner for MVP, moving to implementing');
    await this.transitionToImplementing(workflowId);
  }

  /**
   * Transition workflow to implementing stage
   */
  private async transitionToImplementing(workflowId: string): Promise<void> {
    logger.info('Transitioning to implementing', { workflowId });

    // Update state machine
    this.stateMachine.transition(workflowId, 'implementing', {
      transitionedAt: new Date().toISOString(),
    });

    // Update context
    const context = this.workflowContexts.get(workflowId);
    if (context) {
      context.currentStage = 'implementing';
      this.workflowContexts.set(workflowId, context);
    }

    // Update Notion
    await this.notionService.updateWorkflowStatus(workflowId, 'implementing');

    // Spawn Implementer agent
    this.agentSpawner.spawnAgent({
      type: 'implementer',
      workflowId,
      config: {
        skills: ['coding', 'testing', 'debugging'],
        mcps: ['file_operations', 'git_operations'],
      },
    });

    logger.info('Implementer agent spawned', { workflowId });
  }

  /**
   * Handle completion of Implementer agent
   */
  async handleImplementerCompletion(workflowId: string, output: ImplementerOutput): Promise<void> {
    logger.info('Implementer completed', { workflowId });

    // Store output in context
    const context = this.workflowContexts.get(workflowId);
    if (context) {
      context.implementerOutput = output;
      context.metadata['implementerCompletedAt'] = new Date().toISOString();
      this.workflowContexts.set(workflowId, context);
    }

    // Check if tests passed
    if (!output.testsPassed) {
      logger.warn('Implementer tests failed', { workflowId });
      await this.handleAgentFailure(workflowId, 'implementer', 'Tests failed');
      return;
    }

    // Transition to complete
    await this.transitionToComplete(workflowId);
  }

  /**
   * Transition workflow to complete stage
   */
  private async transitionToComplete(workflowId: string): Promise<void> {
    logger.info('Transitioning to complete', { workflowId });

    // Update state machine
    this.stateMachine.transition(workflowId, 'complete', {
      transitionedAt: new Date().toISOString(),
    });

    // Update context
    const context = this.workflowContexts.get(workflowId);
    if (context) {
      context.currentStage = 'complete';
      context.metadata['completedAt'] = new Date().toISOString();
      this.workflowContexts.set(workflowId, context);
    }

    // Update Notion
    await this.notionService.updateWorkflowStatus(workflowId, 'complete');

    logger.info('Workflow completed successfully', { workflowId });
  }

  /**
   * Handle agent failure
   */
  private async handleAgentFailure(
    workflowId: string,
    agentType: string,
    reason: string
  ): Promise<void> {
    logger.error('Agent failure', { workflowId, agentType, reason });

    // Transition to blocked
    this.stateMachine.transition(workflowId, 'blocked', {
      agentType,
      reason,
      failedAt: new Date().toISOString(),
    });

    // Update context
    const context = this.workflowContexts.get(workflowId);
    if (context) {
      context.currentStage = 'blocked';
      context.metadata['lastFailure'] = { agentType, reason };
      this.workflowContexts.set(workflowId, context);
    }

    // Update Notion
    await this.notionService.updateWorkflowStatus(workflowId, 'blocked');
  }

  /**
   * Retry a blocked workflow
   */
  async retryWorkflow(workflowId: string, fromStage: WorkflowStatus): Promise<void> {
    logger.info('Retrying workflow', { workflowId, fromStage });

    const context = this.workflowContexts.get(workflowId);
    if (!context) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    // Validate workflow is blocked
    if (!this.stateMachine.isBlocked(workflowId)) {
      throw new Error(`Workflow ${workflowId} is not blocked`);
    }

    // Get state before retry
    const stateData = this.stateMachine.getState(workflowId);
    const currentState = stateData?.currentState;

    // Only transition if not already in target state
    if (currentState !== fromStage) {
      // Transition from blocked to target stage
      this.stateMachine.transition(workflowId, fromStage, {
        retryAt: new Date().toISOString(),
      });
    }

    // Route to appropriate stage handler
    // Pass skipTransition=true since we already transitioned from blocked
    switch (fromStage) {
      case 'bootstrapping':
        await this.transitionToBootstrapping(workflowId, true);
        break;
      case 'planning':
        await this.transitionToPlanning(workflowId);
        break;
      case 'implementing':
        await this.transitionToImplementing(workflowId);
        break;
      default:
        throw new Error(`Cannot retry from stage: ${fromStage}`);
    }
  }

  /**
   * Get workflow context
   */
  getWorkflowContext(workflowId: string): WorkflowContext | null {
    return this.workflowContexts.get(workflowId) || null;
  }

  /**
   * Get all active workflows
   */
  getActiveWorkflows(): string[] {
    const active: string[] = [];

    for (const [workflowId, context] of this.workflowContexts.entries()) {
      if (context.currentStage !== 'complete' && context.currentStage !== 'blocked') {
        active.push(workflowId);
      }
    }

    return active;
  }

  /**
   * Validate bootstrapper output
   */
  private validateBootstrapperOutput(output: BootstrapperOutput): boolean {
    return !!(
      output.codebaseAnalysis &&
      output.workflowSpec &&
      output.suggestedApproach &&
      output.estimatedComplexity
    );
  }

  /**
   * Cleanup completed or failed workflows
   */
  cleanupWorkflow(workflowId: string): void {
    logger.info('Cleaning up workflow', { workflowId });

    // Remove from contexts
    this.workflowContexts.delete(workflowId);

    // Remove from state machine
    this.stateMachine.removeWorkflow(workflowId);

    logger.info('Workflow cleanup complete', { workflowId });
  }

  /**
   * Get coordinator statistics
   */
  getStatistics(): {
    activeWorkflows: number;
    completedWorkflows: number;
    blockedWorkflows: number;
    stateMachineStats: ReturnType<WorkflowStateMachine['getStatistics']>;
  } {
    const stateMachineStats = this.stateMachine.getStatistics();

    return {
      activeWorkflows: this.getActiveWorkflows().length,
      completedWorkflows: this.stateMachine.getWorkflowsByState('complete').length,
      blockedWorkflows: this.stateMachine.getWorkflowsByState('blocked').length,
      stateMachineStats,
    };
  }

  /**
   * Shutdown coordinator gracefully
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down AgentFlowCoordinator');

    // Shutdown agent spawner
    await this.agentSpawner.shutdown();

    logger.info('AgentFlowCoordinator shutdown complete');
  }
}
