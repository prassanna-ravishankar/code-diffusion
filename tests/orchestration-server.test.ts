import request from 'supertest';
import { OrchestrationServer } from '../src/orchestration/server';

describe('OrchestrationServer', () => {
  let server: OrchestrationServer;

  beforeEach(() => {
    server = new OrchestrationServer();
  });

  describe('Health Check', () => {
    it('should return 200 on health check', async () => {
      const response = await request(server.getApp()).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('Webhook Endpoint', () => {
    it('should return 401 for missing signature', async () => {
      const response = await request(server.getApp()).post('/notion-webhook').send({
        type: 'page_created',
        page_id: 'test-page-id',
      });

      expect(response.status).toBe(401);
    });

    it('should return 401 for invalid signature even with invalid JSON', async () => {
      const response = await request(server.getApp())
        .post('/notion-webhook')
        .set('x-notion-signature', 'test-signature')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      // Signature check happens first
      expect(response.status).toBe(401);
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(server.getApp()).get('/unknown');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Not found');
    });
  });
});
