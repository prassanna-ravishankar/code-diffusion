/**
 * Code Diffusion - Autonomous Multi-Agent Development System
 * Main entry point for the application
 */

export const version = '0.1.0';

// Export core services
export { NotionService } from './services/notion.service';
export { NotionCRUDService } from './services/notion-crud.service';
export { OrchestrationServer } from './orchestration/server';
export { WebhookHandler } from './orchestration/webhook-handler';
export { AgentSpawner } from './orchestration/agent-spawner';

// Export utilities
export { createLogger, logger } from './utils/logger';
export { verifyWebhookSignature, parseWebhookPayload } from './utils/webhook';

// Export configuration
export { config, loadConfig } from './config';
