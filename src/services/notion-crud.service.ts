/**
 * Notion CRUD Service for Code Diffusion
 * Handles workflow, stage, and subagent task operations
 */

import { Client } from '@notionhq/client';
import type {
  PageObjectResponse,
  QueryDatabaseParameters,
} from '@notionhq/client/build/src/api-endpoints';
import type { WorkflowStatus, StageType, StageStatus, SubagentStatus } from '../types/notion';
import { createLogger } from '../utils/logger';

const logger = createLogger('NotionCRUDService');

export class NotionCRUDService {
  private client: Client;
  private workflowsDbId: string;
  private stagePagesDbId: string;
  private subagentTasksDbId: string;

  constructor(
    apiKey: string,
    databaseIds: {
      workflowsDbId: string;
      stagePagesDbId: string;
      subagentTasksDbId: string;
    }
  ) {
    this.client = new Client({ auth: apiKey });
    this.workflowsDbId = databaseIds.workflowsDbId;
    this.stagePagesDbId = databaseIds.stagePagesDbId;
    this.subagentTasksDbId = databaseIds.subagentTasksDbId;
  }

  /**
   * Create a new workflow
   */
  async createWorkflow(data: {
    title: string;
    request: string;
    repos: string[];
  }): Promise<PageObjectResponse> {
    logger.info('Creating workflow', { title: data.title });

    const response = await this.withRetry(() =>
      this.client.pages.create({
        parent: { database_id: this.workflowsDbId },
        properties: {
          Title: {
            title: [{ text: { content: data.title } }],
          },
          Request: {
            rich_text: [{ text: { content: data.request } }],
          },
          Status: {
            select: { name: 'pending' },
          },
          Repos: {
            multi_select: data.repos.map((repo) => ({ name: repo })),
          },
          Created: {
            date: { start: new Date().toISOString() },
          },
          Updated: {
            date: { start: new Date().toISOString() },
          },
        },
      })
    );

    return response as PageObjectResponse;
  }

  /**
   * Update workflow status
   */
  async updateWorkflowStatus(
    workflowId: string,
    status: WorkflowStatus,
    stage?: StageType
  ): Promise<PageObjectResponse> {
    logger.info('Updating workflow status', { workflowId, status, stage });

    const properties: {
      Status: { select: { name: string } };
      Updated: { date: { start: string } };
      Stage?: { select: { name: string } };
    } = {
      Status: { select: { name: status } },
      Updated: { date: { start: new Date().toISOString() } },
    };

    if (stage) {
      properties.Stage = { select: { name: stage } };
    }

    const response = await this.withRetry(() =>
      this.client.pages.update({
        page_id: workflowId,
        properties: properties as never,
      })
    );

    return response as PageObjectResponse;
  }

  /**
   * Get a workflow by ID
   */
  async getWorkflow(workflowId: string): Promise<PageObjectResponse> {
    logger.info('Getting workflow', { workflowId });

    const response = await this.withRetry(() =>
      this.client.pages.retrieve({ page_id: workflowId })
    );

    return response as PageObjectResponse;
  }

  /**
   * Query workflows with filters
   */
  async queryWorkflows(
    filter?: QueryDatabaseParameters['filter'] | undefined
  ): Promise<PageObjectResponse[]> {
    logger.info('Querying workflows', { filter });

    const queryParams: { database_id: string; filter?: QueryDatabaseParameters['filter'] } = {
      database_id: this.workflowsDbId,
    };

    if (filter) {
      queryParams.filter = filter;
    }

    const response = await this.withRetry(() => this.client.databases.query(queryParams as never));

    return response.results as PageObjectResponse[];
  }

  /**
   * Create a stage page
   */
  async createStagePage(data: {
    workflowId: string;
    stage: StageType;
    content: string;
  }): Promise<PageObjectResponse> {
    logger.info('Creating stage page', { workflowId: data.workflowId, stage: data.stage });

    const response = await this.withRetry(() =>
      this.client.pages.create({
        parent: { database_id: this.stagePagesDbId },
        properties: {
          Title: {
            title: [{ text: { content: `${data.stage} - ${new Date().toISOString()}` } }],
          },
          Workflow: {
            relation: [{ id: data.workflowId }],
          },
          Stage: {
            select: { name: data.stage },
          },
          Status: {
            select: { name: 'in_progress' },
          },
          Content: {
            rich_text: [{ text: { content: data.content } }],
          },
        },
      })
    );

    return response as PageObjectResponse;
  }

  /**
   * Update a stage page
   */
  async updateStagePage(
    stagePageId: string,
    data: {
      status?: StageStatus;
      content?: string;
      workflowSpec?: string;
    }
  ): Promise<PageObjectResponse> {
    logger.info('Updating stage page', { stagePageId });

    const properties: {
      Status?: { select: { name: string } };
      Content?: { rich_text: Array<{ text: { content: string } }> };
      'Workflow Spec'?: { rich_text: Array<{ text: { content: string } }> };
    } = {};

    if (data.status) {
      properties.Status = { select: { name: data.status } };
    }
    if (data.content) {
      properties.Content = { rich_text: [{ text: { content: data.content } }] };
    }
    if (data.workflowSpec) {
      properties['Workflow Spec'] = { rich_text: [{ text: { content: data.workflowSpec } }] };
    }

    const response = await this.withRetry(() =>
      this.client.pages.update({
        page_id: stagePageId,
        properties: properties as never,
      })
    );

    return response as PageObjectResponse;
  }

  /**
   * Create a subagent task
   */
  async createSubagentTask(data: {
    parentPageId: string;
    taskType: string;
    repos: string[];
    skills?: string[];
    mcps?: string[];
  }): Promise<PageObjectResponse> {
    logger.info('Creating subagent task', {
      parentPageId: data.parentPageId,
      taskType: data.taskType,
    });

    const response = await this.withRetry(() =>
      this.client.pages.create({
        parent: { database_id: this.subagentTasksDbId },
        properties: {
          Title: {
            title: [{ text: { content: data.taskType } }],
          },
          'Parent Page': {
            relation: [{ id: data.parentPageId }],
          },
          'Task Type': {
            rich_text: [{ text: { content: data.taskType } }],
          },
          Status: {
            select: { name: 'pending' },
          },
          Repos: {
            multi_select: data.repos.map((repo) => ({ name: repo })),
          },
          Skills: {
            multi_select: (data.skills || []).map((skill) => ({ name: skill })),
          },
          MCPs: {
            multi_select: (data.mcps || []).map((mcp) => ({ name: mcp })),
          },
        },
      })
    );

    return response as PageObjectResponse;
  }

  /**
   * Update a subagent task
   */
  async updateSubagentTask(
    taskId: string,
    data: {
      status?: SubagentStatus;
      output?: string;
      worktree?: string;
      gitRefs?: string;
    }
  ): Promise<PageObjectResponse> {
    logger.info('Updating subagent task', { taskId });

    const properties: {
      Status?: { select: { name: string } };
      Output?: { rich_text: Array<{ text: { content: string } }> };
      Worktree?: { rich_text: Array<{ text: { content: string } }> };
      'Git Refs'?: { rich_text: Array<{ text: { content: string } }> };
    } = {};

    if (data.status) {
      properties.Status = { select: { name: data.status } };
    }
    if (data.output) {
      properties.Output = { rich_text: [{ text: { content: data.output } }] };
    }
    if (data.worktree) {
      properties.Worktree = { rich_text: [{ text: { content: data.worktree } }] };
    }
    if (data.gitRefs) {
      properties['Git Refs'] = { rich_text: [{ text: { content: data.gitRefs } }] };
    }

    const response = await this.withRetry(() =>
      this.client.pages.update({
        page_id: taskId,
        properties: properties as never,
      })
    );

    return response as PageObjectResponse;
  }

  /**
   * Query subagent tasks by parent page
   */
  async querySubagentTasks(parentPageId: string): Promise<PageObjectResponse[]> {
    logger.info('Querying subagent tasks', { parentPageId });

    const response = await this.withRetry(() =>
      this.client.databases.query({
        database_id: this.subagentTasksDbId,
        filter: {
          property: 'Parent Page',
          relation: {
            contains: parentPageId,
          },
        },
      })
    );

    return response.results as PageObjectResponse[];
  }

  /**
   * Retry wrapper with exponential backoff
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        const isRateLimitError = (error as { code?: string }).code === 'rate_limited';

        if (attempt < maxRetries - 1 && isRateLimitError) {
          const delay = baseDelay * Math.pow(2, attempt);
          logger.warn(`Rate limited, retrying in ${delay}ms`, { attempt, maxRetries });
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else if (!isRateLimitError) {
          throw error;
        }
      }
    }

    throw lastError;
  }
}
