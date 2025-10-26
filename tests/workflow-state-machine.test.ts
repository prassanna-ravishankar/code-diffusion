/* eslint-disable @typescript-eslint/no-non-null-assertion */

import {
  WorkflowStateMachine,
  type WorkflowStateData,
} from '../src/orchestration/workflow-state-machine';
import type { WorkflowStatus } from '../src/types/notion';

describe('WorkflowStateMachine', () => {
  let stateMachine: WorkflowStateMachine;

  beforeEach(() => {
    stateMachine = new WorkflowStateMachine();
  });

  describe('initializeWorkflow', () => {
    it('should initialize a new workflow with pending state', () => {
      const workflowId = 'test-workflow-1';
      const state = stateMachine.initializeWorkflow(workflowId);

      expect(state.workflowId).toBe(workflowId);
      expect(state.currentState).toBe('pending');
      expect(state.history).toEqual([]);
      expect(state.createdAt).toBeInstanceOf(Date);
      expect(state.updatedAt).toBeInstanceOf(Date);
    });

    it('should initialize with custom initial state', () => {
      const workflowId = 'test-workflow-2';
      const state = stateMachine.initializeWorkflow(workflowId, 'bootstrapping');

      expect(state.currentState).toBe('bootstrapping');
    });
  });

  describe('getState', () => {
    it('should return workflow state if exists', () => {
      const workflowId = 'test-workflow-3';
      stateMachine.initializeWorkflow(workflowId);

      const state = stateMachine.getState(workflowId);

      expect(state).not.toBeNull();
      expect(state!.workflowId).toBe(workflowId);
    });

    it('should return null for non-existent workflow', () => {
      const state = stateMachine.getState('non-existent');

      expect(state).toBeNull();
    });
  });

  describe('validateTransition', () => {
    it('should allow valid transitions', () => {
      expect(stateMachine.validateTransition('pending', 'bootstrapping')).toBe(true);
      expect(stateMachine.validateTransition('bootstrapping', 'planning')).toBe(true);
      expect(stateMachine.validateTransition('planning', 'implementing')).toBe(true);
      expect(stateMachine.validateTransition('implementing', 'complete')).toBe(true);
    });

    it('should allow transition to blocked from any state', () => {
      expect(stateMachine.validateTransition('pending', 'blocked')).toBe(true);
      expect(stateMachine.validateTransition('bootstrapping', 'blocked')).toBe(true);
      expect(stateMachine.validateTransition('planning', 'blocked')).toBe(true);
      expect(stateMachine.validateTransition('implementing', 'blocked')).toBe(true);
    });

    it('should allow retry from blocked state', () => {
      expect(stateMachine.validateTransition('blocked', 'pending')).toBe(true);
      expect(stateMachine.validateTransition('blocked', 'bootstrapping')).toBe(true);
      expect(stateMachine.validateTransition('blocked', 'planning')).toBe(true);
      expect(stateMachine.validateTransition('blocked', 'implementing')).toBe(true);
    });

    it('should reject invalid transitions', () => {
      expect(stateMachine.validateTransition('pending', 'implementing')).toBe(false);
      expect(stateMachine.validateTransition('bootstrapping', 'complete')).toBe(false);
      expect(stateMachine.validateTransition('complete', 'pending')).toBe(false);
    });

    it('should reject transitions from complete state', () => {
      expect(stateMachine.validateTransition('complete', 'implementing')).toBe(false);
      expect(stateMachine.validateTransition('complete', 'blocked')).toBe(false);
    });
  });

  describe('transition', () => {
    it('should successfully transition to valid state', () => {
      const workflowId = 'test-workflow-4';
      stateMachine.initializeWorkflow(workflowId);

      const state = stateMachine.transition(workflowId, 'bootstrapping');

      expect(state.currentState).toBe('bootstrapping');
      expect(state.previousState).toBe('pending');
      expect(state.history).toHaveLength(1);
      expect(state.history[0]!.from).toBe('pending');
      expect(state.history[0]!.to).toBe('bootstrapping');
    });

    it('should record transition metadata', () => {
      const workflowId = 'test-workflow-5';
      stateMachine.initializeWorkflow(workflowId);

      const metadata = { reason: 'test', agentId: 'agent-123' };
      const state = stateMachine.transition(workflowId, 'bootstrapping', metadata);

      expect(state.history[0]!.metadata).toEqual(metadata);
      expect(state.metadata).toMatchObject(metadata);
    });

    it('should throw error for invalid transition', () => {
      const workflowId = 'test-workflow-6';
      stateMachine.initializeWorkflow(workflowId);

      expect(() => {
        stateMachine.transition(workflowId, 'implementing');
      }).toThrow('Invalid state transition');
    });

    it('should throw error for non-existent workflow', () => {
      expect(() => {
        stateMachine.transition('non-existent', 'bootstrapping');
      }).toThrow('Workflow non-existent not found');
    });

    it('should maintain complete transition history', () => {
      const workflowId = 'test-workflow-7';
      stateMachine.initializeWorkflow(workflowId);

      stateMachine.transition(workflowId, 'bootstrapping');
      stateMachine.transition(workflowId, 'planning');
      stateMachine.transition(workflowId, 'implementing');
      const finalState = stateMachine.transition(workflowId, 'complete');

      expect(finalState.history).toHaveLength(4);
      expect(finalState.currentState).toBe('complete');
    });
  });

  describe('isTerminalState', () => {
    it('should return true for complete state', () => {
      const workflowId = 'test-workflow-8';
      stateMachine.initializeWorkflow(workflowId);
      stateMachine.transition(workflowId, 'bootstrapping');
      stateMachine.transition(workflowId, 'planning');
      stateMachine.transition(workflowId, 'implementing');
      stateMachine.transition(workflowId, 'complete');

      expect(stateMachine.isTerminalState(workflowId)).toBe(true);
    });

    it('should return false for non-terminal states', () => {
      const workflowId = 'test-workflow-9';
      stateMachine.initializeWorkflow(workflowId);

      expect(stateMachine.isTerminalState(workflowId)).toBe(false);

      stateMachine.transition(workflowId, 'bootstrapping');
      expect(stateMachine.isTerminalState(workflowId)).toBe(false);
    });
  });

  describe('isBlocked', () => {
    it('should return true for blocked state', () => {
      const workflowId = 'test-workflow-10';
      stateMachine.initializeWorkflow(workflowId);
      stateMachine.transition(workflowId, 'blocked');

      expect(stateMachine.isBlocked(workflowId)).toBe(true);
    });

    it('should return false for non-blocked states', () => {
      const workflowId = 'test-workflow-11';
      stateMachine.initializeWorkflow(workflowId);

      expect(stateMachine.isBlocked(workflowId)).toBe(false);
    });
  });

  describe('getHistory', () => {
    it('should return complete transition history', () => {
      const workflowId = 'test-workflow-12';
      stateMachine.initializeWorkflow(workflowId);
      stateMachine.transition(workflowId, 'bootstrapping');
      stateMachine.transition(workflowId, 'planning');

      const history = stateMachine.getHistory(workflowId);

      expect(history).toHaveLength(2);
      expect(history[0]!.from).toBe('pending');
      expect(history[1]!.to).toBe('planning');
    });

    it('should return empty array for non-existent workflow', () => {
      const history = stateMachine.getHistory('non-existent');

      expect(history).toEqual([]);
    });
  });

  describe('getWorkflowsByState', () => {
    it('should return all workflows in specific state', () => {
      stateMachine.initializeWorkflow('workflow-1', 'pending');
      stateMachine.initializeWorkflow('workflow-2', 'pending');
      stateMachine.initializeWorkflow('workflow-3', 'bootstrapping');

      const pendingWorkflows = stateMachine.getWorkflowsByState('pending');

      expect(pendingWorkflows).toHaveLength(2);
      expect(pendingWorkflows).toContain('workflow-1');
      expect(pendingWorkflows).toContain('workflow-2');
    });

    it('should return empty array when no workflows in state', () => {
      stateMachine.initializeWorkflow('workflow-1', 'pending');

      const completedWorkflows = stateMachine.getWorkflowsByState('complete');

      expect(completedWorkflows).toEqual([]);
    });
  });

  describe('removeWorkflow', () => {
    it('should remove existing workflow', () => {
      const workflowId = 'test-workflow-13';
      stateMachine.initializeWorkflow(workflowId);

      const removed = stateMachine.removeWorkflow(workflowId);

      expect(removed).toBe(true);
      expect(stateMachine.getState(workflowId)).toBeNull();
    });

    it('should return false for non-existent workflow', () => {
      const removed = stateMachine.removeWorkflow('non-existent');

      expect(removed).toBe(false);
    });
  });

  describe('restoreState', () => {
    it('should restore workflow state from data', () => {
      const stateData: WorkflowStateData = {
        workflowId: 'restored-workflow',
        currentState: 'planning' as WorkflowStatus,
        previousState: 'bootstrapping' as WorkflowStatus,
        history: [
          {
            from: 'pending' as WorkflowStatus,
            to: 'bootstrapping' as WorkflowStatus,
            timestamp: new Date('2024-01-01'),
          },
          {
            from: 'bootstrapping' as WorkflowStatus,
            to: 'planning' as WorkflowStatus,
            timestamp: new Date('2024-01-02'),
          },
        ],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        metadata: { restored: true },
      };

      stateMachine.restoreState('restored-workflow', stateData);

      const state = stateMachine.getState('restored-workflow');

      expect(state).not.toBeNull();
      expect(state!.currentState).toBe('planning');
      expect(state!.history).toHaveLength(2);
    });
  });

  describe('getStatistics', () => {
    it('should return accurate statistics', () => {
      stateMachine.initializeWorkflow('wf-1', 'pending');
      stateMachine.initializeWorkflow('wf-2', 'pending');
      stateMachine.initializeWorkflow('wf-3', 'bootstrapping');
      stateMachine.transition('wf-1', 'bootstrapping');

      const stats = stateMachine.getStatistics();

      expect(stats.totalWorkflows).toBe(3);
      expect(stats.byState.pending).toBe(1);
      expect(stats.byState.bootstrapping).toBe(2);
      expect(stats.averageTransitions).toBeGreaterThan(0);
    });

    it('should handle empty state machine', () => {
      const stats = stateMachine.getStatistics();

      expect(stats.totalWorkflows).toBe(0);
      expect(stats.averageTransitions).toBe(0);
    });
  });
});
