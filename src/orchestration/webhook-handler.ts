/**
 * Webhook Handler for Code Diffusion
 * Processes different webhook events from Notion
 */

import { createLogger } from '../utils/logger';
import { AgentSpawner } from './agent-spawner';
import { AgentFlowCoordinator } from './agent-flow-coordinator';
import type { WebhookPayload } from '../utils/webhook';

const logger = createLogger('WebhookHandler');

export interface ExtendedWebhookPayload extends WebhookPayload {
  data?: {
    workflow_id?: string;
    status?: string;
    stage?: string;
    page_id?: string;
    parent_page_id?: string;
    task_type?: string;
  };
}

export class WebhookHandler {
  private agentSpawner: AgentSpawner;
  private flowCoordinator: AgentFlowCoordinator | null = null;

  constructor() {
    this.agentSpawner = new AgentSpawner();

    // Initialize flow coordinator if API keys are available
    const notionKey = process.env['NOTION_API_KEY'];
    const claudeKey = process.env['CLAUDE_API_KEY'];

    if (notionKey && claudeKey) {
      this.flowCoordinator = new AgentFlowCoordinator({
        notionApiKey: notionKey,
        claudeApiKey: claudeKey,
        databaseIds: {
          workflowsDbId: process.env['NOTION_WORKFLOWS_DB_ID'] || '',
          stagePagesDbId: process.env['NOTION_STAGE_PAGES_DB_ID'] || '',
          subagentTasksDbId: process.env['NOTION_SUBAGENT_TASKS_DB_ID'] || '',
        },
      });
      logger.info('Flow coordinator initialized');
    } else {
      logger.warn('Flow coordinator not initialized - missing API keys');
    }
  }

  /**
   * Process incoming webhook payload
   */
  processWebhook(payload: ExtendedWebhookPayload): void {
    logger.info('Processing webhook', { type: payload.type });

    switch (payload.type) {
      case 'page_created':
        this.handlePageCreated(payload);
        break;
      case 'page_updated':
        this.handlePageUpdated(payload);
        break;
      case 'database_created':
        this.handleDatabaseCreated(payload);
        break;
      case 'database_updated':
        this.handleDatabaseUpdated(payload);
        break;
      default:
        logger.warn('Unknown webhook type', { type: payload.type });
    }
  }

  /**
   * Handle page created event
   */
  private handlePageCreated(payload: ExtendedWebhookPayload): void {
    logger.info('Handling page created', { pageId: payload.page_id });

    // Check if this is a new workflow
    if (payload.data?.workflow_id) {
      this.startWorkflow(payload.data.workflow_id);
    }

    // Check if this is a new subagent task
    if (payload.data?.task_type) {
      this.startSubagentTask(payload.page_id!, payload.data);
    }
  }

  /**
   * Handle page updated event
   */
  private handlePageUpdated(payload: ExtendedWebhookPayload): void {
    logger.info('Handling page updated', { pageId: payload.page_id });

    // Check if workflow status changed
    if (payload.data?.status && payload.data?.workflow_id) {
      this.handleWorkflowStatusChange(payload.data.workflow_id, payload.data.status);
    }

    // Check if stage completed
    if (payload.data?.stage && payload.data?.status === 'complete') {
      this.handleStageCompletion(payload.page_id!, payload.data.stage);
    }
  }

  /**
   * Handle database created event
   */
  private handleDatabaseCreated(payload: ExtendedWebhookPayload): void {
    logger.info('Handling database created', { databaseId: payload.database_id });
    // Future implementation for dynamic database creation
  }

  /**
   * Handle database updated event
   */
  private handleDatabaseUpdated(payload: ExtendedWebhookPayload): void {
    logger.info('Handling database updated', { databaseId: payload.database_id });
    // Future implementation for database schema updates
  }

  /**
   * Start a new workflow by spawning bootstrapper agent
   */
  private startWorkflow(workflowId: string): void {
    logger.info('Starting workflow', { workflowId });

    // Use flow coordinator if available, otherwise fall back to direct spawning
    if (this.flowCoordinator) {
      this.flowCoordinator.startWorkflow(workflowId).catch((error: unknown) => {
        logger.error('Flow coordinator failed to start workflow', { workflowId, error });
      });
    } else {
      // Fallback to direct agent spawning
      this.agentSpawner.spawnAgent({
        type: 'bootstrapper',
        workflowId,
        config: {
          skills: [],
          mcps: ['codebase_search'],
        },
      });
    }
  }

  /**
   * Start a subagent task
   */
  private startSubagentTask(
    taskId: string,
    data: { task_type?: string; parent_page_id?: string }
  ): void {
    logger.info('Starting subagent task', { taskId, taskType: data.task_type });

    this.agentSpawner.spawnAgent({
      type: 'subagent',
      taskId,
      parentPageId: data.parent_page_id,
      config: {
        skills: [],
        mcps: [],
      },
    });
  }

  /**
   * Handle workflow status change
   */
  private handleWorkflowStatusChange(workflowId: string, status: string): void {
    logger.info('Workflow status changed', { workflowId, status });

    // Trigger next stage based on status
    switch (status) {
      case 'bootstrapping':
        // Bootstrapper is already running
        break;
      case 'planning':
        this.spawnPlannerAgent(workflowId);
        break;
      case 'implementing':
        this.spawnImplementerAgent(workflowId);
        break;
      case 'complete':
        logger.info('Workflow completed', { workflowId });
        break;
      default:
        logger.debug('No action for status', { status });
    }
  }

  /**
   * Handle stage completion
   */
  private handleStageCompletion(stagePageId: string, stage: string): void {
    logger.info('Stage completed', { stagePageId, stage });

    // Future implementation for stage-specific actions
  }

  /**
   * Spawn planner agent
   */
  private spawnPlannerAgent(workflowId: string): void {
    logger.info('Spawning planner agent', { workflowId });

    this.agentSpawner.spawnAgent({
      type: 'planner',
      workflowId,
      config: {
        skills: ['planning', 'architecture'],
        mcps: ['pattern_analysis'],
      },
    });
  }

  /**
   * Spawn implementer agent
   */
  private spawnImplementerAgent(workflowId: string): void {
    logger.info('Spawning implementer agent', { workflowId });

    this.agentSpawner.spawnAgent({
      type: 'implementer',
      workflowId,
      config: {
        skills: ['coding', 'testing'],
        mcps: ['file_operations'],
      },
    });
  }
}
