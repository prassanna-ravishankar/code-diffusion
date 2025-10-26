/**
 * Notion Service for Code Diffusion
 * Handles all interactions with Notion API including database creation and management
 */

import { Client } from '@notionhq/client';
import type {
  CreateDatabaseParameters,
  CreateDatabaseResponse,
} from '@notionhq/client/build/src/api-endpoints';

export class NotionService {
  private client: Client;
  private workflowsDbId: string | undefined;
  private stagePagesDbId: string | undefined;
  private subagentTasksDbId: string | undefined;

  constructor(apiKey: string) {
    this.client = new Client({ auth: apiKey });
  }

  /**
   * Create the Workflows database with all required properties
   */
  async createWorkflowsDatabase(parentPageId: string): Promise<CreateDatabaseResponse> {
    const database: CreateDatabaseParameters = {
      parent: {
        type: 'page_id',
        page_id: parentPageId,
      },
      title: [
        {
          type: 'text',
          text: {
            content: 'Workflows',
          },
        },
      ],
      properties: {
        Title: {
          title: {},
        },
        Request: {
          rich_text: {},
        },
        Status: {
          select: {
            options: [
              { name: 'pending', color: 'gray' },
              { name: 'bootstrapping', color: 'blue' },
              { name: 'planning', color: 'purple' },
              { name: 'implementing', color: 'yellow' },
              { name: 'complete', color: 'green' },
              { name: 'blocked', color: 'red' },
            ],
          },
        },
        Stage: {
          select: {
            options: [
              { name: 'bootstrapper', color: 'blue' },
              { name: 'planner', color: 'purple' },
              { name: 'implementer', color: 'yellow' },
            ],
          },
        },
        Repos: {
          multi_select: {
            options: [],
          },
        },
        Created: {
          date: {},
        },
        Updated: {
          date: {},
        },
      },
    };

    const response = await this.client.databases.create(database);
    this.workflowsDbId = response.id;
    return response;
  }

  /**
   * Create the Stage Pages database with relations to Workflows
   */
  async createStagePagesDatabase(parentPageId: string): Promise<CreateDatabaseResponse> {
    if (!this.workflowsDbId) {
      throw new Error('Workflows database must be created first');
    }

    const database: CreateDatabaseParameters = {
      parent: {
        type: 'page_id',
        page_id: parentPageId,
      },
      title: [
        {
          type: 'text',
          text: {
            content: 'Stage Pages',
          },
        },
      ],
      properties: {
        Title: {
          title: {},
        },
        Workflow: {
          relation: {
            database_id: this.workflowsDbId,
            type: 'single_property',
            single_property: {},
          },
        },
        Stage: {
          select: {
            options: [
              { name: 'bootstrapper', color: 'blue' },
              { name: 'planner', color: 'purple' },
              { name: 'implementer', color: 'yellow' },
            ],
          },
        },
        Status: {
          select: {
            options: [
              { name: 'in_progress', color: 'yellow' },
              { name: 'complete', color: 'green' },
              { name: 'needs_review', color: 'orange' },
            ],
          },
        },
        Content: {
          rich_text: {},
        },
        'Workflow Spec': {
          rich_text: {},
        },
      },
    };

    const response = await this.client.databases.create(database);
    this.stagePagesDbId = response.id;
    return response;
  }

  /**
   * Create the Subagent Tasks database with relations to Stage Pages
   */
  async createSubagentTasksDatabase(parentPageId: string): Promise<CreateDatabaseResponse> {
    if (!this.stagePagesDbId) {
      throw new Error('Stage Pages database must be created first');
    }

    const database: CreateDatabaseParameters = {
      parent: {
        type: 'page_id',
        page_id: parentPageId,
      },
      title: [
        {
          type: 'text',
          text: {
            content: 'Subagent Tasks',
          },
        },
      ],
      properties: {
        Title: {
          title: {},
        },
        'Parent Page': {
          relation: {
            database_id: this.stagePagesDbId,
            type: 'single_property',
            single_property: {},
          },
        },
        'Task Type': {
          rich_text: {},
        },
        Status: {
          select: {
            options: [
              { name: 'pending', color: 'gray' },
              { name: 'running', color: 'yellow' },
              { name: 'complete', color: 'green' },
              { name: 'failed', color: 'red' },
            ],
          },
        },
        Repos: {
          multi_select: {
            options: [],
          },
        },
        Worktree: {
          rich_text: {},
        },
        Skills: {
          multi_select: {
            options: [],
          },
        },
        MCPs: {
          multi_select: {
            options: [],
          },
        },
        Output: {
          rich_text: {},
        },
        'Git Refs': {
          rich_text: {},
        },
      },
    };

    const response = await this.client.databases.create(database);
    this.subagentTasksDbId = response.id;
    return response;
  }

  /**
   * Create all databases in the correct order
   */
  async createAllDatabases(parentPageId: string): Promise<{
    workflowsDb: CreateDatabaseResponse;
    stagePagesDb: CreateDatabaseResponse;
    subagentTasksDb: CreateDatabaseResponse;
  }> {
    const workflowsDb = await this.createWorkflowsDatabase(parentPageId);
    const stagePagesDb = await this.createStagePagesDatabase(parentPageId);
    const subagentTasksDb = await this.createSubagentTasksDatabase(parentPageId);

    return {
      workflowsDb,
      stagePagesDb,
      subagentTasksDb,
    };
  }

  /**
   * Get database IDs
   */
  getDatabaseIds(): {
    workflowsDbId: string | undefined;
    stagePagesDbId: string | undefined;
    subagentTasksDbId: string | undefined;
  } {
    return {
      workflowsDbId: this.workflowsDbId,
      stagePagesDbId: this.stagePagesDbId,
      subagentTasksDbId: this.subagentTasksDbId,
    };
  }

  /**
   * Set database IDs (for use with existing databases)
   */
  setDatabaseIds(ids: {
    workflowsDbId: string | undefined;
    stagePagesDbId: string | undefined;
    subagentTasksDbId: string | undefined;
  }): void {
    this.workflowsDbId = ids.workflowsDbId;
    this.stagePagesDbId = ids.stagePagesDbId;
    this.subagentTasksDbId = ids.subagentTasksDbId;
  }
}
