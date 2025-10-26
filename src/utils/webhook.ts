/**
 * Webhook utilities for Notion integration
 */

import crypto from 'crypto';
import { createLogger } from './logger';

const logger = createLogger('WebhookUtils');

/**
 * Verify Notion webhook signature
 * @param body - Raw webhook request body
 * @param signature - Signature from request header
 * @param secret - Webhook secret
 */
export function verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
  try {
    const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch (error) {
    logger.error('Error verifying webhook signature', { error });
    return false;
  }
}

/**
 * Webhook payload interface
 */
export interface WebhookPayload {
  type: 'page_created' | 'page_updated' | 'database_created' | 'database_updated';
  page_id?: string;
  database_id?: string;
  timestamp: string;
}

/**
 * Parse webhook payload
 */
export function parseWebhookPayload(body: string): WebhookPayload | null {
  try {
    const payload = JSON.parse(body) as WebhookPayload;
    return payload;
  } catch (error) {
    logger.error('Error parsing webhook payload', { error });
    return null;
  }
}
