import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isOrderOverdue, operationalBucket } from './operational-notifications';

describe('operational notifications', () => {
  it('uses stable cooldown buckets for duplicate-worker notification ids', () => {
    const base = new Date('2026-10-13T00:00:00Z');
    assert.equal(operationalBucket(base, 24), operationalBucket(new Date('2026-10-13T23:59:59Z'), 24));
  });

  it('classifies only configured overdue order states', () => {
    const now = new Date('2026-10-13T12:00:00Z');
    const thresholds = { PENDING: 24, CONFIRMED: 12 };
    assert.equal(isOrderOverdue({ status: 'PENDING', updatedAt: new Date('2026-10-12T11:59:00Z') }, now, thresholds), true);
    assert.equal(isOrderOverdue({ status: 'PENDING', updatedAt: new Date('2026-10-13T11:00:00Z') }, now, thresholds), false);
    assert.equal(isOrderOverdue({ status: 'DELIVERED', updatedAt: new Date('2020-01-01T00:00:00Z') }, now, thresholds), false);
  });
});
