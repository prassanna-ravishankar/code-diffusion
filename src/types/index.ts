/**
 * Core type definitions for Code Diffusion
 */

export interface WorkflowConfig {
  id: string;
  title: string;
  status: WorkflowStatus;
}

export type WorkflowStatus =
  | 'pending'
  | 'bootstrapping'
  | 'planning'
  | 'implementing'
  | 'complete'
  | 'blocked';

export type AgentStage = 'bootstrapper' | 'planner' | 'implementer';
