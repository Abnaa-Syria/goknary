import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { payoutFingerprint } from './payouts';

describe('payout idempotency fingerprint', () => {
  it('is stable for the same payout and changes for material payload changes', () => {
    const input = { amount: 100.25, paymentMethod: 'BANK_TRANSFER', paymentDetails: '{"account":"1"}' };
    assert.equal(payoutFingerprint(input), payoutFingerprint({ ...input }));
    assert.notEqual(payoutFingerprint(input), payoutFingerprint({ ...input, amount: 100.26 }));
    assert.notEqual(payoutFingerprint(input), payoutFingerprint({ ...input, paymentDetails: '{"account":"2"}' }));
  });
});
