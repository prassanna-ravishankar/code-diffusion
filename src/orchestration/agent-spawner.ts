/**
 * Agent Spawner for Code Diffusion
 * Handles spawning and managing agent processes
 */

import { spawn, type ChildProcess } from 'child_process';
import { createLogger } from '../utils/logger';

const logger = createLogger('AgentSpawner');

export interface AgentConfig {
  type: 'bootstrapper' | 'planner' | 'implementer' | 'subagent';
  workflowId?: string | undefined;
  taskId?: string | undefined;
  parentPageId?: string | undefined;
  config: {
    skills: string[];
    mcps: string[];
    worktree?: string | undefined;
  };
}

export interface SpawnedAgent {
  process: ChildProcess;
  id: string;
  type: string;
  startTime: Date;
}

export class AgentSpawner {
  private activeAgents: Map<string, SpawnedAgent> = new Map();
  private readonly maxConcurrentAgents = 10;

  /**
   * Spawn a new agent process
   */
  spawnAgent(config: AgentConfig): string {
    const agentId = this.generateAgentId(config);

    logger.info('Spawning agent', {
      agentId,
      type: config.type,
      workflowId: config.workflowId,
      taskId: config.taskId,
    });

    // Check concurrent limit
    if (this.activeAgents.size >= this.maxConcurrentAgents) {
      logger.warn('Max concurrent agents reached, queueing', { agentId });
      // In a production system, implement a queue here
      throw new Error('Max concurrent agents reached');
    }

    // Spawn the process
    const childProcess = this.createAgentProcess(config);

    // Track the agent
    const spawnedAgent: SpawnedAgent = {
      process: childProcess,
      id: agentId,
      type: config.type,
      startTime: new Date(),
    };

    this.activeAgents.set(agentId, spawnedAgent);

    // Set up process handlers
    this.setupProcessHandlers(agentId, childProcess);

    return agentId;
  }

  /**
   * Create the agent child process
   */
  private createAgentProcess(config: AgentConfig): ChildProcess {
    // In a real implementation, this would spawn claude-code or a custom agent script
    // For now, create a placeholder process

    const args = this.buildAgentArgs(config);

    logger.debug('Agent command', { args });

    // Example: spawn a Node.js script that would be the actual agent
    const childProcess = spawn('node', ['-e', 'console.log("Agent started"); process.exit(0)'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    return childProcess;
  }

  /**
   * Build arguments for agent execution
   */
  private buildAgentArgs(config: AgentConfig): string[] {
    const args: string[] = [];

    // Add skills
    config.config.skills.forEach((skill) => {
      args.push('--skill', skill);
    });

    // Add MCPs
    config.config.mcps.forEach((mcp) => {
      args.push('--mcp', mcp);
    });

    // Add workflow/task context
    if (config.workflowId) {
      args.push('--workflow-id', config.workflowId);
    }
    if (config.taskId) {
      args.push('--task-id', config.taskId);
    }
    if (config.parentPageId) {
      args.push('--parent-page', config.parentPageId);
    }

    // Add worktree if specified
    if (config.config.worktree) {
      args.push('--worktree', config.config.worktree);
    }

    return args;
  }

  /**
   * Set up handlers for process events
   */
  private setupProcessHandlers(agentId: string, childProcess: ChildProcess): void {
    // Handle stdout
    childProcess.stdout?.on('data', (data: Buffer) => {
      logger.debug('Agent output', { agentId, output: data.toString() });
    });

    // Handle stderr
    childProcess.stderr?.on('data', (data: Buffer) => {
      logger.error('Agent error', { agentId, error: data.toString() });
    });

    // Handle process exit
    childProcess.on('exit', (code: number | null, signal: string | null) => {
      logger.info('Agent exited', { agentId, code, signal });
      this.handleAgentExit(agentId, code, signal);
    });

    // Handle process errors
    childProcess.on('error', (error: Error) => {
      logger.error('Agent process error', { agentId, error });
      this.handleAgentError(agentId, error);
    });

    // Set up timeout
    setTimeout(
      () => {
        if (this.activeAgents.has(agentId)) {
          logger.warn('Agent timeout, killing process', { agentId });
          this.killAgent(agentId);
        }
      },
      30 * 60 * 1000
    ); // 30 minute timeout
  }

  /**
   * Handle agent exit
   */
  private handleAgentExit(agentId: string, code: number | null, signal: string | null): void {
    const agent = this.activeAgents.get(agentId);
    if (!agent) return;

    const duration = Date.now() - agent.startTime.getTime();

    logger.info('Agent completed', {
      agentId,
      type: agent.type,
      duration,
      exitCode: code,
      signal,
    });

    this.activeAgents.delete(agentId);
  }

  /**
   * Handle agent error
   */
  private handleAgentError(agentId: string, error: Error): void {
    logger.error('Agent failed', { agentId, error });
    this.activeAgents.delete(agentId);
  }

  /**
   * Kill an agent process
   */
  killAgent(agentId: string): boolean {
    const agent = this.activeAgents.get(agentId);
    if (!agent) {
      logger.warn('Agent not found for kill', { agentId });
      return false;
    }

    logger.info('Killing agent', { agentId });

    try {
      agent.process.kill('SIGTERM');

      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (this.activeAgents.has(agentId)) {
          logger.warn('Force killing agent', { agentId });
          agent.process.kill('SIGKILL');
        }
      }, 5000);

      return true;
    } catch (error) {
      logger.error('Error killing agent', { agentId, error });
      return false;
    }
  }

  /**
   * Get active agents
   */
  getActiveAgents(): SpawnedAgent[] {
    return Array.from(this.activeAgents.values());
  }

  /**
   * Generate unique agent ID
   */
  private generateAgentId(config: AgentConfig): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `${config.type}-${config.workflowId || config.taskId || 'unknown'}-${timestamp}-${random}`;
  }

  /**
   * Shutdown all agents
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down all agents');

    const killPromises = Array.from(this.activeAgents.keys()).map((agentId) =>
      Promise.resolve(this.killAgent(agentId))
    );

    await Promise.all(killPromises);

    logger.info('All agents shut down');
  }
}
