/**
 * Workflow Error Handler for Code Diffusion
 * Handles errors with retry logic and recovery strategies
 */

import { createLogger } from '../utils/logger';
import type { WorkflowStatus } from '../types/notion';

const logger = createLogger('WorkflowErrorHandler');

export interface ErrorContext {
  workflowId: string;
  stage: WorkflowStatus;
  error: Error;
  attemptNumber: number;
  maxAttempts: number;
}

export type RecoveryStrategy = 'retry' | 'skip' | 'block' | 'rollback';

export interface ErrorHandlingResult {
  shouldRetry: boolean;
  strategy: RecoveryStrategy;
  retryDelay?: number;
  message: string;
}

/**
 * Workflow Error Handler
 * Provides error categorization and recovery strategies
 */
export class WorkflowErrorHandler {
  private errorCounts: Map<string, number> = new Map();
  private readonly maxRetries = 3;
  private readonly baseDelay = 1000; // 1 second

  /**
   * Handle an error and determine recovery strategy
   */
  handleError(context: ErrorContext): ErrorHandlingResult {
    const { workflowId, stage, error, attemptNumber } = context;

    logger.error('Workflow error occurred', {
      workflowId,
      stage,
      error: error.message,
      attempt: attemptNumber,
    });

    // Categorize error
    const isRecoverable = this.isRecoverableError(error);
    const shouldRetry = isRecoverable && attemptNumber < this.maxRetries;

    // Track error count
    const errorKey = `${workflowId}-${stage}`;
    const errorCount = (this.errorCounts.get(errorKey) || 0) + 1;
    this.errorCounts.set(errorKey, errorCount);

    if (shouldRetry) {
      const retryDelay = this.calculateBackoff(attemptNumber);
      logger.info('Error is recoverable, will retry', {
        workflowId,
        attempt: attemptNumber + 1,
        maxAttempts: this.maxRetries,
        retryDelay,
      });

      return {
        shouldRetry: true,
        strategy: 'retry',
        retryDelay,
        message: `Retrying after ${retryDelay}ms (attempt ${attemptNumber + 1}/${this.maxRetries})`,
      };
    }

    // Non-recoverable or max retries exceeded
    logger.warn('Error not recoverable or max retries exceeded', {
      workflowId,
      stage,
      errorCount,
    });

    return {
      shouldRetry: false,
      strategy: 'block',
      message: `Workflow blocked at ${stage}: ${error.message}`,
    };
  }

  /**
   * Check if an error is recoverable
   */
  private isRecoverableError(error: Error): boolean {
    const recoverablePatterns = [
      /ECONNREFUSED/i,
      /ETIMEDOUT/i,
      /ENOTFOUND/i,
      /rate limit/i,
      /timeout/i,
      /network/i,
      /temporary/i,
    ];

    const errorMessage = error.message.toLowerCase();

    return recoverablePatterns.some((pattern) => pattern.test(errorMessage));
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(attemptNumber: number): number {
    // Exponential backoff: baseDelay * 2^attemptNumber with jitter
    const exponentialDelay = this.baseDelay * Math.pow(2, attemptNumber);
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter
    return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
  }

  /**
   * Reset error count for a workflow
   */
  resetErrorCount(workflowId: string, stage: WorkflowStatus): void {
    const errorKey = `${workflowId}-${stage}`;
    this.errorCounts.delete(errorKey);
    logger.debug('Error count reset', { workflowId, stage });
  }

  /**
   * Get error count for a workflow stage
   */
  getErrorCount(workflowId: string, stage: WorkflowStatus): number {
    const errorKey = `${workflowId}-${stage}`;
    return this.errorCounts.get(errorKey) || 0;
  }

  /**
   * Clear all error tracking
   */
  clearAllErrors(): void {
    this.errorCounts.clear();
    logger.info('All error counts cleared');
  }

  /**
   * Get error statistics
   */
  getStatistics(): {
    totalErrors: number;
    errorsByWorkflow: Record<string, number>;
  } {
    const errorsByWorkflow: Record<string, number> = {};

    for (const [key, count] of this.errorCounts.entries()) {
      const workflowId = key.split('-')[0] || '';
      errorsByWorkflow[workflowId] = (errorsByWorkflow[workflowId] || 0) + count;
    }

    const totalErrors = Array.from(this.errorCounts.values()).reduce(
      (sum: number, count: number) => sum + count,
      0
    );

    return {
      totalErrors,
      errorsByWorkflow,
    };
  }
}
