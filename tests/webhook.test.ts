import crypto from 'crypto';
import { verifyWebhookSignature, parseWebhookPayload } from '../src/utils/webhook';

describe('Webhook Utilities', () => {
  const secret = 'test_secret';

  describe('verifyWebhookSignature', () => {
    it('should verify valid signature', () => {
      const body = JSON.stringify({ test: 'data' });
      const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');

      expect(verifyWebhookSignature(body, signature, secret)).toBe(true);
    });

    it('should reject invalid signature', () => {
      const body = JSON.stringify({ test: 'data' });
      const invalidSignature = 'invalid_signature';

      expect(verifyWebhookSignature(body, invalidSignature, secret)).toBe(false);
    });

    it('should reject tampered body', () => {
      const body = JSON.stringify({ test: 'data' });
      const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
      const tamperedBody = JSON.stringify({ test: 'tampered' });

      expect(verifyWebhookSignature(tamperedBody, signature, secret)).toBe(false);
    });
  });

  describe('parseWebhookPayload', () => {
    it('should parse valid payload', () => {
      const payload = {
        type: 'page_created',
        page_id: 'test-page-id',
        timestamp: new Date().toISOString(),
      };
      const body = JSON.stringify(payload);

      const result = parseWebhookPayload(body);
      expect(result).toEqual(payload);
    });

    it('should return null for invalid JSON', () => {
      const invalidBody = 'not valid json';

      const result = parseWebhookPayload(invalidBody);
      expect(result).toBeNull();
    });
  });
});
