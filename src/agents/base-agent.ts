/**
 * Base Agent class for Code Diffusion
 * Provides common functionality for all agent types
 */

import { createLogger } from '../utils/logger';
import type { Logger } from 'winston';

export interface BaseAgentConfig {
  agentId: string;
  workflowId?: string;
  taskId?: string;
  notionApiKey: string;
  claudeApiKey: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export abstract class BaseAgent {
  protected config: BaseAgentConfig;
  protected logger: Logger;
  protected isRunning = false;

  constructor(config: BaseAgentConfig) {
    this.config = config;
    this.logger = createLogger(this.getAgentType());

    this.validateConfig();
  }

  /**
   * Get the agent type name for logging
   */
  protected abstract getAgentType(): string;

  /**
   * Main execution method - must be implemented by subclasses
   */
  abstract execute(): Promise<void>;

  /**
   * Validate agent configuration
   */
  protected validateConfig(): void {
    if (!this.config.agentId) {
      throw new Error('Agent ID is required');
    }
    if (!this.config.notionApiKey) {
      throw new Error('Notion API key is required');
    }
    if (!this.config.claudeApiKey) {
      throw new Error('Claude API key is required');
    }
  }

  /**
   * Start the agent execution
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Agent is already running');
    }

    this.isRunning = true;
    this.logger.info('Agent starting', {
      agentId: this.config.agentId,
      workflowId: this.config.workflowId,
      taskId: this.config.taskId,
    });

    try {
      await this.execute();
      this.logger.info('Agent completed successfully', { agentId: this.config.agentId });
    } catch (error) {
      this.logger.error('Agent execution failed', { agentId: this.config.agentId, error });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Stop the agent execution
   */
  stop(): void {
    this.logger.info('Agent stopping', { agentId: this.config.agentId });
    this.isRunning = false;
  }

  /**
   * Get agent status
   */
  getStatus(): { isRunning: boolean; agentId: string; type: string } {
    return {
      isRunning: this.isRunning,
      agentId: this.config.agentId,
      type: this.getAgentType(),
    };
  }
}
