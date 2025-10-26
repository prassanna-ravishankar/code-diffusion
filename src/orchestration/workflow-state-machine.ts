/**
 * Workflow State Machine for Code Diffusion
 * Manages workflow state transitions with validation and persistence
 */

import { createLogger } from '../utils/logger';
import type { WorkflowStatus } from '../types/notion';

const logger = createLogger('WorkflowStateMachine');

export type WorkflowState = WorkflowStatus;

export interface StateTransition {
  from: WorkflowState;
  to: WorkflowState;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface WorkflowStateData {
  workflowId: string;
  currentState: WorkflowState;
  previousState?: WorkflowState;
  history: StateTransition[];
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
}

/**
 * Defines valid state transitions
 */
const VALID_TRANSITIONS: Record<WorkflowState, WorkflowState[]> = {
  pending: ['bootstrapping', 'blocked'],
  bootstrapping: ['planning', 'blocked', 'pending'],
  planning: ['implementing', 'blocked', 'bootstrapping'],
  implementing: ['complete', 'blocked', 'planning'],
  complete: [], // Terminal state
  blocked: ['pending', 'bootstrapping', 'planning', 'implementing'], // Can retry from blocked
};

/**
 * Workflow State Machine
 * Manages workflow state transitions with validation
 */
export class WorkflowStateMachine {
  private states: Map<string, WorkflowStateData> = new Map();

  /**
   * Initialize a new workflow state
   */
  initializeWorkflow(
    workflowId: string,
    initialState: WorkflowState = 'pending'
  ): WorkflowStateData {
    logger.info('Initializing workflow state', { workflowId, initialState });

    const stateData: WorkflowStateData = {
      workflowId,
      currentState: initialState,
      history: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {},
    };

    this.states.set(workflowId, stateData);
    return stateData;
  }

  /**
   * Get current state for a workflow
   */
  getState(workflowId: string): WorkflowStateData | null {
    return this.states.get(workflowId) || null;
  }

  /**
   * Validate if a state transition is allowed
   */
  validateTransition(from: WorkflowState, to: WorkflowState): boolean {
    const validTargets = VALID_TRANSITIONS[from];
    const isValid = validTargets.includes(to);

    if (!isValid) {
      logger.warn('Invalid state transition attempted', { from, to, validTargets });
    }

    return isValid;
  }

  /**
   * Transition workflow to a new state
   */
  transition(
    workflowId: string,
    toState: WorkflowState,
    metadata?: Record<string, unknown>
  ): WorkflowStateData {
    const stateData = this.states.get(workflowId);

    if (!stateData) {
      throw new Error(`Workflow ${workflowId} not found in state machine`);
    }

    const fromState = stateData.currentState;

    // Validate transition
    if (!this.validateTransition(fromState, toState)) {
      throw new Error(
        `Invalid state transition for workflow ${workflowId}: ${fromState} -> ${toState}`
      );
    }

    logger.info('State transition', { workflowId, from: fromState, to: toState });

    // Record transition
    const transition: StateTransition = {
      from: fromState,
      to: toState,
      timestamp: new Date(),
      ...(metadata && { metadata }),
    };

    // Update state
    stateData.previousState = fromState;
    stateData.currentState = toState;
    stateData.history.push(transition);
    stateData.updatedAt = new Date();

    if (metadata) {
      stateData.metadata = { ...stateData.metadata, ...metadata };
    }

    this.states.set(workflowId, stateData);

    logger.debug('State transition complete', {
      workflowId,
      currentState: stateData.currentState,
      historyLength: stateData.history.length,
    });

    return stateData;
  }

  /**
   * Check if workflow is in a terminal state
   */
  isTerminalState(workflowId: string): boolean {
    const stateData = this.states.get(workflowId);
    return stateData?.currentState === 'complete';
  }

  /**
   * Check if workflow is blocked
   */
  isBlocked(workflowId: string): boolean {
    const stateData = this.states.get(workflowId);
    return stateData?.currentState === 'blocked';
  }

  /**
   * Get workflow history
   */
  getHistory(workflowId: string): StateTransition[] {
    const stateData = this.states.get(workflowId);
    return stateData?.history || [];
  }

  /**
   * Get all workflows in a specific state
   */
  getWorkflowsByState(state: WorkflowState): string[] {
    const workflows: string[] = [];

    for (const [workflowId, stateData] of this.states.entries()) {
      if (stateData.currentState === state) {
        workflows.push(workflowId);
      }
    }

    return workflows;
  }

  /**
   * Remove workflow from state machine (cleanup)
   */
  removeWorkflow(workflowId: string): boolean {
    const existed = this.states.has(workflowId);
    this.states.delete(workflowId);

    if (existed) {
      logger.info('Workflow removed from state machine', { workflowId });
    }

    return existed;
  }

  /**
   * Get all workflow states (for debugging/monitoring)
   */
  getAllStates(): Map<string, WorkflowStateData> {
    return new Map(this.states);
  }

  /**
   * Persist state to storage (simplified in-memory for now)
   * In production, this would write to a database or file system
   */
  persistState(workflowId: string): void {
    const stateData = this.states.get(workflowId);

    if (!stateData) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    // TODO: Implement actual persistence (e.g., to database, Redis, or filesystem)
    logger.debug('State persisted (in-memory)', { workflowId });
  }

  /**
   * Restore state from storage
   */
  restoreState(workflowId: string, stateData: WorkflowStateData): void {
    this.states.set(workflowId, {
      ...stateData,
      // Ensure dates are Date objects
      createdAt: new Date(stateData.createdAt),
      updatedAt: new Date(stateData.updatedAt),
      history: stateData.history.map((t) => ({
        ...t,
        timestamp: new Date(t.timestamp),
      })),
    });

    logger.info('State restored', { workflowId, currentState: stateData.currentState });
  }

  /**
   * Get state machine statistics
   */
  getStatistics(): {
    totalWorkflows: number;
    byState: Record<WorkflowState, number>;
    averageTransitions: number;
  } {
    const byState: Record<string, number> = {
      pending: 0,
      bootstrapping: 0,
      planning: 0,
      implementing: 0,
      complete: 0,
      blocked: 0,
    };

    let totalTransitions = 0;

    for (const stateData of this.states.values()) {
      const currentState = stateData.currentState;
      byState[currentState] = (byState[currentState] || 0) + 1;
      totalTransitions += stateData.history.length;
    }

    return {
      totalWorkflows: this.states.size,
      byState: byState as Record<WorkflowState, number>,
      averageTransitions: this.states.size > 0 ? totalTransitions / this.states.size : 0,
    };
  }
}
