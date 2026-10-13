import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import axios from 'axios';
import { KashierService } from './kashier.service.js';

const originalPost = axios.post;
const originalGet = axios.get;
afterEach(() => {
  axios.post = originalPost;
  axios.get = originalGet;
});

const makeService = () => {
  const service = new KashierService();
  service.apiKey = 'test-api-key';
  service.secretKey = 'test-secret-key';
  service.merchantId = 'TEST-MERCHANT';
  return service;
};

describe('Kashier stable checkout reference', () => {
  it('sends the stable attempt reference and persists the returned session continuation', async () => {
    let sentPayload: any;
    axios.post = (async (_url: string, payload: any) => {
      sentPayload = payload;
      return { data: { _id: 'session-1', sessionUrl: 'https://example.test/session-1', status: 'CREATED' } };
    }) as any;
    const service = makeService();
    const expiresAt = new Date('2026-10-11T13:00:00.000Z');
    const result = await service.createPaymentSession('gk_checkout_attempt-1', 125, 'buyer@example.com', 'EGP', ['o-1', 'o-2'], expiresAt);
    assert.equal(sentPayload.order, 'gk_checkout_attempt-1');
    assert.equal(sentPayload.expireAt, expiresAt.toISOString());
    assert.equal(result.expiresAt.toISOString(), expiresAt.toISOString());
    assert.equal(result.sessionId, 'session-1');
    assert.equal(result.sessionUrl, 'https://example.test/session-1');
  });

  it('marks a network-lost response as ambiguous so callers never initiate blindly', async () => {
    axios.post = (async () => { throw new Error('socket timeout'); }) as any;
    const service = makeService();
    await assert.rejects(
      service.createPaymentSession('gk_checkout_attempt-2', 125, 'buyer@example.com'),
      (error: any) => error.ambiguous === true,
    );
  });

  it('reconciles an ambiguous result by exact merchant reference and session id', async () => {
    axios.get = (async (url: string) => {
      if (url.includes('/payment/orders')) {
        return { data: { data: [{ orderReference: 'gk_checkout_attempt-3', sessionId: 'session-3' }] } };
      }
      return { data: { _id: 'session-3', sessionUrl: 'https://example.test/session-3', status: 'CREATED' } };
    }) as any;
    const service = makeService();
    const recovered = await service.findPaymentSessionByReference('gk_checkout_attempt-3');
    assert.equal(recovered?.sessionId, 'session-3');
    assert.equal(recovered?.sessionUrl, 'https://example.test/session-3');
  });

  it('treats a confirmed provider rejection as retryable but not ambiguous', async () => {
    axios.post = (async () => {
      throw { response: { status: 400, data: { code: 'INVALID_REQUEST', message: 'invalid' } } };
    }) as any;
    const service = makeService();
    await assert.rejects(
      service.createPaymentSession('gk_checkout_attempt-4', 125, 'buyer@example.com'),
      (error: any) => error.ambiguous === false && error.providerCode === 'INVALID_REQUEST',
    );
  });

  it('treats Kashier duplicate-reference rejection as ambiguous and recoverable', async () => {
    axios.post = (async () => {
      throw { response: { status: 409, data: { code: 'ERR_ORD_02', message: 'duplicate order' } } };
    }) as any;
    const service = makeService();
    await assert.rejects(
      service.createPaymentSession('gk_checkout_attempt-5', 125, 'buyer@example.com'),
      (error: any) => error.ambiguous === true,
    );
  });
});
