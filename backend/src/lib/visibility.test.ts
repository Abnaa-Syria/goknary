import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toPublicProduct } from './visibility';

describe('toPublicProduct', () => {
  it('removes moderation and internal ranking fields from customer responses', () => {
    const publicProduct = toPublicProduct({
      id: 'product-1',
      name: 'Public name',
      status: 'APPROVED',
      lowStockThreshold: 5,
      rejectionReason: 'internal note',
      submittedAt: new Date('2026-01-01'),
      reviewedAt: new Date('2026-01-02'),
      reviewedBy: 'staff-user-id',
      rankingScore: 42,
      rankingUpdatedAt: new Date('2026-01-03'),
      vendor: { slug: 'vendor' },
    });

    assert.deepEqual(publicProduct, {
      id: 'product-1',
      name: 'Public name',
      vendor: { slug: 'vendor' },
    });
  });
});
