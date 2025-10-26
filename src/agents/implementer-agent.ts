/**
 * Implementer Agent for Code Diffusion
 * Executes code implementation tasks based on specifications
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { BaseAgent, type BaseAgentConfig } from './base-agent';
import Anthropic from '@anthropic-ai/sdk';
import { NotionCRUDService } from '../services/notion-crud.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ImplementerConfig extends BaseAgentConfig {
  targetRepositoryPath: string;
  testCommand?: string;
  buildCommand?: string;
  maxRetries?: number;
}

export interface ImplementationTask {
  taskId: string;
  description: string;
  filePath: string;
  implementation: string;
  testStrategy?: string;
}

export interface ImplementationResult {
  taskId: string;
  success: boolean;
  filesModified: string[];
  testsRun: boolean;
  testsPassed: boolean;
  error?: string;
}

/**
 * Implementer Agent - Executes code implementation tasks
 * Takes specifications and generates/modifies code
 */
export class ImplementerAgent extends BaseAgent {
  private anthropic: Anthropic;
  private notionService: NotionCRUDService;
  private implementerConfig: ImplementerConfig;

  constructor(config: ImplementerConfig) {
    super(config);
    this.implementerConfig = config;

    // Initialize Anthropic client
    this.anthropic = new Anthropic({
      apiKey: config.claudeApiKey,
    });

    // Initialize Notion service
    this.notionService = new NotionCRUDService(config.notionApiKey, {
      workflowsDbId: process.env['NOTION_WORKFLOWS_DB_ID'] || '',
      stagePagesDbId: process.env['NOTION_STAGE_PAGES_DB_ID'] || '',
      subagentTasksDbId: process.env['NOTION_SUBAGENT_TASKS_DB_ID'] || '',
    });

    this.logger.info('ImplementerAgent initialized', {
      agentId: config.agentId,
      workflowId: config.workflowId,
      targetRepository: config.targetRepositoryPath,
    });
  }

  protected getAgentType(): string {
    return 'ImplementerAgent';
  }

  /**
   * Main execution method
   */
  async execute(): Promise<void> {
    this.logger.info('Starting implementer execution', {
      workflowId: this.config.workflowId,
    });

    try {
      // Step 1: Fetch implementation tasks from Notion
      const tasks = await this.fetchImplementationTasks();
      this.logger.info('Implementation tasks fetched', { count: tasks.length });

      // Step 2: Execute each task
      const results: ImplementationResult[] = [];
      for (const task of tasks) {
        this.logger.info('Executing task', { taskId: task.taskId });
        const result = await this.executeTask(task);
        results.push(result);

        // Update task status in Notion
        await this.updateTaskStatus(task.taskId, result);
      }

      // Step 3: Run full test suite
      this.logger.info('Running full test suite');
      const testResults = await this.runTests();

      // Step 4: Write results to Notion
      await this.writeResultsToNotion(results, testResults);
      this.logger.info('Implementation complete');
    } catch (error) {
      this.logger.error('Implementer execution failed', { error });
      throw error;
    }
  }

  /**
   * Fetch implementation tasks from Notion
   */
  private async fetchImplementationTasks(): Promise<ImplementationTask[]> {
    if (!this.config.workflowId) {
      throw new Error('Workflow ID is required');
    }

    // Fetch tasks from Notion
    const subagentTasks = await this.notionService.querySubagentTasks(this.config.workflowId);

    // Convert to implementation tasks
    const tasks: ImplementationTask[] = subagentTasks.map((task: any) => {
      const descProp = task.properties['Description'];
      const filePathProp = task.properties['File Path'];
      const implProp = task.properties['Implementation'];
      const testProp = task.properties['Test Strategy'];

      return {
        taskId: task.id,
        description:
          descProp && descProp.type === 'rich_text'
            ? descProp.rich_text.map((rt: any) => rt.plain_text).join('')
            : '',
        filePath:
          filePathProp && filePathProp.type === 'rich_text'
            ? filePathProp.rich_text.map((rt: any) => rt.plain_text).join('')
            : '',
        implementation:
          implProp && implProp.type === 'rich_text'
            ? implProp.rich_text.map((rt: any) => rt.plain_text).join('')
            : '',
        testStrategy:
          testProp && testProp.type === 'rich_text'
            ? testProp.rich_text.map((rt: any) => rt.plain_text).join('')
            : undefined,
      };
    });

    return tasks;
  }

  /**
   * Execute a single implementation task
   */
  private async executeTask(task: ImplementationTask): Promise<ImplementationResult> {
    const result: ImplementationResult = {
      taskId: task.taskId,
      success: false,
      filesModified: [],
      testsRun: false,
      testsPassed: false,
    };

    try {
      // Generate implementation using Claude if not provided
      let implementation = task.implementation;
      if (!implementation || implementation.trim() === '') {
        this.logger.info('Generating implementation with Claude', { taskId: task.taskId });
        implementation = await this.generateImplementation(task);
      }

      // Write implementation to file
      const targetPath = path.join(this.implementerConfig.targetRepositoryPath, task.filePath);
      await this.ensureDirectoryExists(path.dirname(targetPath));
      await fs.writeFile(targetPath, implementation, 'utf-8');

      result.filesModified.push(task.filePath);
      this.logger.info('File written', { filePath: task.filePath });

      // Run tests if test strategy is provided
      if (task.testStrategy) {
        result.testsRun = true;
        const testPassed = await this.runTaskTests(task);
        result.testsPassed = testPassed;
      }

      result.success = !result.testsRun || result.testsPassed;
    } catch (error) {
      this.logger.error('Task execution failed', { taskId: task.taskId, error });
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  /**
   * Generate implementation using Claude
   */
  private async generateImplementation(task: ImplementationTask): Promise<string> {
    const prompt = `You are an expert software engineer. Generate the implementation for the following task:

Task Description:
${task.description}

File Path: ${task.filePath}

${task.testStrategy ? `Test Strategy:\n${task.testStrategy}` : ''}

Generate only the code implementation. Do not include explanations or markdown formatting.
Return the complete file content ready to be written to disk.`;

    const message = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => ('text' in block ? block.text : ''))
      .join('\n');

    return responseText.trim();
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore error
    }
  }

  /**
   * Run tests for a specific task
   */
  private async runTaskTests(task: ImplementationTask): Promise<boolean> {
    if (!this.implementerConfig.testCommand) {
      this.logger.warn('No test command configured, skipping tests');
      return true;
    }

    try {
      const testCommand = this.implementerConfig.testCommand.replace('{file}', task.filePath);

      this.logger.info('Running task tests', { command: testCommand });

      await execAsync(testCommand, {
        cwd: this.implementerConfig.targetRepositoryPath,
        timeout: 60000, // 1 minute timeout
      });

      return true;
    } catch (error) {
      this.logger.error('Task tests failed', { taskId: task.taskId, error });
      return false;
    }
  }

  /**
   * Run full test suite
   */
  private async runTests(): Promise<{ passed: boolean; output: string }> {
    if (!this.implementerConfig.testCommand) {
      return { passed: true, output: 'No test command configured' };
    }

    try {
      const { stdout, stderr } = await execAsync(this.implementerConfig.testCommand, {
        cwd: this.implementerConfig.targetRepositoryPath,
        timeout: 120000, // 2 minute timeout
      });

      return {
        passed: true,
        output: stdout + stderr,
      };
    } catch (error) {
      const execError = error as { stdout?: string; stderr?: string };
      return {
        passed: false,
        output: (execError.stdout || '') + (execError.stderr || ''),
      };
    }
  }

  /**
   * Update task status in Notion
   */
  private async updateTaskStatus(taskId: string, result: ImplementationResult): Promise<void> {
    await this.notionService.updateSubagentTask(taskId, {
      status: result.success ? 'complete' : 'failed',
    });
  }

  /**
   * Write results to Notion
   */
  private async writeResultsToNotion(
    results: ImplementationResult[],
    testResults: { passed: boolean; output: string }
  ): Promise<void> {
    if (!this.config.workflowId) {
      throw new Error('Workflow ID is required');
    }

    const summary = {
      totalTasks: results.length,
      successfulTasks: results.filter((r) => r.success).length,
      failedTasks: results.filter((r) => !r.success).length,
      filesModified: Array.from(new Set(results.flatMap((r) => r.filesModified))),
      testsPassed: testResults.passed,
      testOutput: testResults.output.slice(0, 1000), // Limit output size
    };

    this.logger.info('Writing implementation results to Notion', {
      workflowId: this.config.workflowId,
      summary,
    });

    // Create a stage page for implementation results
    await this.notionService.createStagePage({
      workflowId: this.config.workflowId,
      stage: 'implementer',
      content: JSON.stringify(summary, null, 2),
    });

    // Update workflow status
    const newStatus = testResults.passed ? 'complete' : 'blocked';
    await this.notionService.updateWorkflowStatus(this.config.workflowId, newStatus);

    this.logger.info('Implementation stage complete', { status: newStatus });
  }
}
