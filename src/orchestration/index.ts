/**
 * Orchestration Server Entry Point
 */

import { OrchestrationServer } from './server';
import { createLogger } from '../utils/logger';

const logger = createLogger('Main');

// Create and start server
const server = new OrchestrationServer();

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start the server
server.start();
