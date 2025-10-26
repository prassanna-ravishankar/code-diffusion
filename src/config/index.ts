/**
 * Configuration management for Code Diffusion
 */

import { config as loadEnv } from 'dotenv';

loadEnv();

export interface Config {
  notion: {
    apiKey: string;
    workflowsDbId: string;
    stagePagesDbId: string;
    subagentTasksDbId: string;
    parentPageId: string;
  };
  server: {
    port: number;
    nodeEnv: string;
  };
  anthropic: {
    apiKey: string;
  };
}

function getEnvVar(key: string, defaultValue?: string, required = true): string {
  const value = process.env[key] || defaultValue;
  if (!value && required && process.env['NODE_ENV'] !== 'test') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || '';
}

export function loadConfig(): Config {
  const isTest = process.env['NODE_ENV'] === 'test';

  return {
    notion: {
      apiKey: getEnvVar('NOTION_API_KEY', isTest ? 'test_key' : '', !isTest),
      workflowsDbId: getEnvVar('NOTION_WORKFLOWS_DB_ID', '', false),
      stagePagesDbId: getEnvVar('NOTION_STAGE_PAGES_DB_ID', '', false),
      subagentTasksDbId: getEnvVar('NOTION_SUBAGENT_TASKS_DB_ID', '', false),
      parentPageId: getEnvVar('NOTION_PARENT_PAGE_ID', '', false),
    },
    server: {
      port: parseInt(getEnvVar('PORT', '3000', false), 10),
      nodeEnv: getEnvVar('NODE_ENV', 'development', false),
    },
    anthropic: {
      apiKey: getEnvVar('ANTHROPIC_API_KEY', isTest ? 'test_key' : '', !isTest),
    },
  };
}

export const config = loadConfig();
