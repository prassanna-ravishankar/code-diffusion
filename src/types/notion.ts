/**
 * Notion-specific type definitions for Code Diffusion
 */

export type WorkflowStatus =
  | 'pending'
  | 'bootstrapping'
  | 'planning'
  | 'implementing'
  | 'complete'
  | 'blocked';

export type StageType = 'bootstrapper' | 'planner' | 'implementer';

export type StageStatus = 'in_progress' | 'complete' | 'needs_review';

export type SubagentStatus = 'pending' | 'running' | 'complete' | 'failed';

export interface WorkflowProperties {
  title: string;
  request: string;
  status: WorkflowStatus;
  stage: StageType;
  repos: string[];
  created: string;
  updated: string;
  bootstrapper_page_id?: string;
  planner_page_id?: string;
  implementer_page_id?: string;
}

export interface StagePageProperties {
  workflow_id: string;
  stage: StageType;
  status: StageStatus;
  content: string;
  workflow_spec?: string; // JSON string
  subagent_task_ids: string[];
}

export interface SubagentTaskProperties {
  parent_page_id: string;
  task_type: string;
  status: SubagentStatus;
  repos: string[];
  worktree?: string;
  skills: string[];
  mcps: string[];
  output: string;
  git_refs?: string; // JSON string
}

export interface WorkflowSpec {
  planner_config?: {
    subagents: SubagentConfig[];
  };
  implementer_config?: {
    subagents: SubagentConfig[];
  };
}

export interface SubagentConfig {
  name: string;
  task_type?: string;
  repos: string[];
  worktree?: string;
  skills: string[];
  mcps: string[];
  dependencies?: string[];
  prompt_context?: string;
}
