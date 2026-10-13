import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OrderStatus } from '@prisma/client';
import { ORDER_STATUS_FLOW } from './order-state.service';

describe('central order state machine', () => {
  it('allows only forward fulfilment transitions and guarded pre-shipment cancellation', () => {
    assert.deepEqual(ORDER_STATUS_FLOW.PENDING, [OrderStatus.CONFIRMED, OrderStatus.CANCELLED]);
    assert.deepEqual(ORDER_STATUS_FLOW.CONFIRMED, [OrderStatus.PROCESSING, OrderStatus.CANCELLED]);
    assert.deepEqual(ORDER_STATUS_FLOW.PROCESSING, [OrderStatus.SHIPPED, OrderStatus.CANCELLED]);
    assert.deepEqual(ORDER_STATUS_FLOW.SHIPPED, [OrderStatus.DELIVERED]);
  });

  it('keeps terminal states terminal', () => {
    assert.deepEqual(ORDER_STATUS_FLOW.DELIVERED, []);
    assert.deepEqual(ORDER_STATUS_FLOW.CANCELLED, []);
    assert.deepEqual(ORDER_STATUS_FLOW.REFUNDED, []);
  });
});

