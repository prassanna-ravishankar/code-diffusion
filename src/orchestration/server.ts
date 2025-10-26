/**
 * Orchestration Server for Code Diffusion
 * Handles webhook events from Notion and coordinates agent spawning
 */

import express, { type Application, type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { config } from '../config';
import { createLogger } from '../utils/logger';
import { WebhookHandler, type ExtendedWebhookPayload } from './webhook-handler';
import { verifyWebhookSignature } from '../utils/webhook';

const logger = createLogger('OrchestrationServer');

export class OrchestrationServer {
  private app: Application;
  private webhookHandler: WebhookHandler;

  constructor() {
    this.app = express();
    this.webhookHandler = new WebhookHandler();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Set up middleware
   */
  private setupMiddleware(): void {
    // Security headers
    this.app.use(helmet());

    // CORS configuration
    this.app.use(
      cors({
        origin: config.server.nodeEnv === 'production' ? false : '*',
        credentials: true,
      })
    );

    // Request logging
    this.app.use((req: Request, _res: Response, next: NextFunction) => {
      logger.info('Incoming request', {
        method: req.method,
        path: req.path,
        ip: req.ip,
      });
      next();
    });

    // Raw body parser for webhook signature verification
    this.app.use(
      '/notion-webhook',
      express.raw({ type: 'application/json' }),
      (req: Request, _res: Response, next: NextFunction) => {
        // Store raw body for signature verification
        req.body = { raw: req.body as Buffer };
        next();
      }
    );

    // JSON parser for other routes
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  /**
   * Set up routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    // Webhook endpoint with rate limiting
    const webhookLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: 'Too many webhook requests from this IP',
      standardHeaders: true,
      legacyHeaders: false,
    });

    this.app.post(
      '/notion-webhook',
      webhookLimiter,
      (req: Request, res: Response, next: NextFunction) => {
        try {
          this.handleWebhook(req, res);
        } catch (error) {
          next(error);
        }
      }
    );

    // 404 handler
    this.app.use((_req: Request, res: Response) => {
      res.status(404).json({ error: 'Not found' });
    });
  }

  /**
   * Handle webhook requests
   */
  private handleWebhook(req: Request, res: Response): void {
    logger.info('Webhook received');

    // Verify signature
    const signature = req.headers['x-notion-signature'] as string;
    const body = req.body as { raw?: Buffer };
    const rawBody = body?.raw?.toString() || '';
    const webhookSecret = process.env['NOTION_WEBHOOK_SECRET'] || '';

    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      logger.warn('Invalid webhook signature');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    // Parse webhook payload
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody) as unknown;
    } catch (error) {
      logger.error('Failed to parse webhook payload', { error });
      res.status(400).json({ error: 'Invalid JSON payload' });
      return;
    }

    // Process webhook
    try {
      this.webhookHandler.processWebhook(payload as ExtendedWebhookPayload);
      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Error processing webhook', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Set up error handling
   */
  private setupErrorHandling(): void {
    this.app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      logger.error('Unhandled error', { error: err });

      res.status(500).json({
        error: config.server.nodeEnv === 'production' ? 'Internal server error' : err.message,
      });
    });
  }

  /**
   * Start the server
   */
  start(): void {
    const port = config.server.port;

    this.app.listen(port, () => {
      logger.info(`Orchestration server started on port ${port}`);
    });
  }

  /**
   * Get the Express app (for testing)
   */
  getApp(): Application {
    return this.app;
  }
}
