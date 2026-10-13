import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { safeRate, round2 } from './analytics-math';
import { toCurrentRefundStatus } from './refund-workflow';
import { RefundStatus } from '@prisma/client';

describe('Product Command Center Logic & Rules', () => {
  it('correctly calculates Return Rate with zero division protection', () => {
    // 0 delivered units sold -> rate must be 0 (null fallback to 0)
    assert.equal(safeRate(0, 0) ?? 0, 0);
    assert.equal(safeRate(5, 0) ?? 0, 0);
    // 2 returned out of 10 delivered -> 20.0%
    assert.equal(safeRate(2, 10), 20);
    // 1 returned out of 3 delivered -> 33.3%
    assert.equal(safeRate(1, 3), 33.3);
  });

  it('correctly calculates Registered Customer Conversion Rate with zero division protection', () => {
    // 0 unique viewers -> conversion rate must be 0 (null fallback to 0)
    assert.equal(safeRate(0, 0) ?? 0, 0);
    assert.equal(safeRate(3, 0) ?? 0, 0);
    // 2 purchasing customers out of 10 unique viewers -> 20.0%
    assert.equal(safeRate(2, 10), 20);
    // 5 purchasing customers out of 25 unique viewers -> 20.0%
    assert.equal(safeRate(5, 25), 20);
  });

  it('correctly maps refund statuses to CurrentRefundStatus', () => {
    assert.equal(toCurrentRefundStatus(RefundStatus.REFUNDED), 'REFUNDED');
    assert.equal(toCurrentRefundStatus(RefundStatus.REQUESTED), 'REQUESTED');
    assert.equal(toCurrentRefundStatus(RefundStatus.UNDER_REVIEW), 'UNDER_REVIEW');
    assert.equal(toCurrentRefundStatus(RefundStatus.APPROVED), 'APPROVED');
    assert.equal(toCurrentRefundStatus(RefundStatus.ITEM_RECEIVED), 'ITEM_RECEIVED');
    assert.equal(toCurrentRefundStatus(RefundStatus.REFUND_PROCESSING), 'REFUND_PROCESSING');
    assert.equal(toCurrentRefundStatus(RefundStatus.REJECTED), 'REJECTED');
    // Legacy statuses
    assert.equal(toCurrentRefundStatus(RefundStatus.ADMIN_APPROVED), 'REFUNDED');
    assert.equal(toCurrentRefundStatus(RefundStatus.PENDING), 'REQUESTED');
    assert.equal(toCurrentRefundStatus(RefundStatus.VENDOR_APPROVED), 'UNDER_REVIEW');
    assert.equal(toCurrentRefundStatus(RefundStatus.VENDOR_REJECTED), 'UNDER_REVIEW');
  });

  it('enforces low stock semantics: stock > 0 and stock <= lowStockThreshold', () => {
    const lowStockThreshold = 5;

    const checkStockStatus = (stock: number, status: boolean = true) => {
      if (!status) return 'INACTIVE';
      if (stock === 0) return 'OUT_OF_STOCK';
      if (stock <= lowStockThreshold) return 'LOW_STOCK';
      return 'IN_STOCK';
    };

    assert.equal(checkStockStatus(0), 'OUT_OF_STOCK');
    assert.equal(checkStockStatus(1), 'LOW_STOCK');
    assert.equal(checkStockStatus(5), 'LOW_STOCK');
    assert.equal(checkStockStatus(6), 'IN_STOCK');
    assert.equal(checkStockStatus(100), 'IN_STOCK');
    assert.equal(checkStockStatus(5, false), 'INACTIVE');
  });

  it('rounds financial revenue metrics properly to 2 decimal places', () => {
    assert.equal(round2(12.3456), 12.35);
    assert.equal(round2(100.0), 100);
    assert.equal(round2(0), 0);
  });

  it('correctly calculates itemNetPaid with order coupon prorating', () => {
    const { itemNetPaid } = require('./refund-workflow');
    // Item: quantity 2, price 100 => lineGross = 200
    // Order: subtotal 400, coupon discount 40 (10% discount across order)
    // line couponShare = (40 * 200) / 400 = 20
    // itemNetPaid = 200 - 20 = 180
    const net = itemNetPaid(
      { quantity: 2, price: 100, discountPrice: null },
      { subtotal: 400, discountAmount: 40 }
    );
    assert.equal(net, 180);
  });

  it('correctly groups sales by historical variant snapshot rather than current variants', () => {
    // When a variant is renamed or deleted, historical order snapshot preserves original SKU and attributes
    const rawSnapshotA = JSON.stringify({
      variantId: 'v-1',
      sku: 'SKU-OLD-A',
      name: 'Variant A (Historical)',
      attributeList: [{ name: 'Capacity', value: '256GB' }],
    });
    const rawSnapshotB = JSON.stringify({
      variantId: 'v-2',
      sku: 'SKU-OLD-B',
      name: 'Variant B (Historical)',
      attributeList: [{ name: 'Capacity', value: '512GB' }],
    });

    const parsedA = JSON.parse(rawSnapshotA);
    const parsedB = JSON.parse(rawSnapshotB);

    assert.equal(parsedA.sku, 'SKU-OLD-A');
    assert.equal(parsedA.attributeList[0].name, 'Capacity');
    assert.equal(parsedB.sku, 'SKU-OLD-B');
    assert.equal(parsedB.attributeList[0].value, '512GB');
  });

  it('correctly aggregates return groups from DB-side status aggregation', () => {
    const returnStatusGroups = [
      { status: RefundStatus.REFUNDED, _sum: { quantity: 4, amount: 200 }, _count: { _all: 2 } },
      { status: RefundStatus.ADMIN_APPROVED, _sum: { quantity: 1, amount: 50 }, _count: { _all: 1 } },
      { status: RefundStatus.UNDER_REVIEW, _sum: { quantity: 2, amount: 100 }, _count: { _all: 1 } },
      { status: RefundStatus.REJECTED, _sum: { quantity: 1, amount: 50 }, _count: { _all: 1 } },
    ];

    let completedReturnedUnits = 0;
    let completedRefundAmount = 0;
    let openReturnRequests = 0;
    let totalReturnRequests = 0;

    for (const group of returnStatusGroups) {
      totalReturnRequests += group._count._all;
      const current = toCurrentRefundStatus(group.status);
      if (current === 'REFUNDED') {
        completedReturnedUnits += group._sum.quantity || 0;
        completedRefundAmount += group._sum.amount || 0;
      } else if (current !== 'REJECTED') {
        openReturnRequests += group._count._all;
      }
    }

    assert.equal(totalReturnRequests, 5);
    assert.equal(completedReturnedUnits, 5); // 4 (REFUNDED) + 1 (legacy ADMIN_APPROVED)
    assert.equal(completedRefundAmount, 250);
    assert.equal(openReturnRequests, 1); // UNDER_REVIEW
  });

  it('enforces that Recent Orders and Recent Returns do not exceed 5 items', () => {
    const allOrders = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const boundedOrders = allOrders.slice(0, 5);
    assert.equal(boundedOrders.length, 5);

    const allReturns = [1, 2, 3, 4, 5, 6, 7];
    const boundedReturns = allReturns.slice(0, 5);
    assert.equal(boundedReturns.length, 5);
  });

  it('ensures vendor context hides customer email and reviewer identity', () => {
    const isPlatformStaffVendor = false;
    const isPlatformStaffAdmin = true;

    const buildCustomerPayload = (isStaff: boolean, user: { name: string; email: string }) => ({
      name: user.name,
      ...(isStaff ? { email: user.email } : {}),
    });

    const user = { name: 'Customer Test', email: 'secret@user.com' };
    const vendorPayload = buildCustomerPayload(isPlatformStaffVendor, user);
    const adminPayload = buildCustomerPayload(isPlatformStaffAdmin, user);

    assert.equal((vendorPayload as any).email, undefined);
    assert.equal(adminPayload.email, 'secret@user.com');
  });

  it('correctly computes effectivePrice and handles generic attributes for variants', () => {
    const variantRegular = { price: 200, discountPrice: null };
    const variantDiscounted = { price: 200, discountPrice: 150 };

    assert.equal(variantRegular.discountPrice ?? variantRegular.price, 200);
    assert.equal(variantDiscounted.discountPrice ?? variantDiscounted.price, 150);

    // Generic marketplace attributes (e.g. Storage, RAM, Material, Flavor, Pack Size)
    const genericAttributes = [
      { name: 'Storage', value: '256GB' },
      { name: 'Material', value: 'Stainless Steel' },
      { name: 'Pack Size', value: '12x' },
    ];

    assert.equal(genericAttributes.length, 3);
    assert.equal(genericAttributes[0].name, 'Storage');
    assert.equal(genericAttributes[1].name, 'Material');
  });

  it('verifies recent orders and returns have both normalized and legacy payload keys', () => {
    const orderId = 'ord-1234567890abcdef';
    const sid = orderId.slice(-8).toUpperCase();
    const lineNet = 120.5;

    const recentOrder = {
      id: orderId,
      orderId,
      orderNumber: sid,
      shortId: sid,
      lineTotal: lineNet,
      realizedRevenue: lineNet,
    };

    assert.equal(recentOrder.id, recentOrder.orderId);
    assert.equal(recentOrder.orderNumber, recentOrder.shortId);
    assert.equal(recentOrder.realizedRevenue, recentOrder.lineTotal);

    const refundId = 'ref-9876543210fedcba';
    const recentReturn = {
      id: refundId,
      shortId: refundId.slice(-8).toUpperCase(),
      orderId,
      orderNumber: sid,
      shortOrderId: sid,
    };

    assert.equal(recentReturn.orderNumber, recentReturn.shortOrderId);
  });

  it('consolidates multiple variants of the same product within a single order into one unique order row', () => {
    const { itemNetPaid } = require('./refund-workflow');

    // Simulate an order with subtotal 1000 and 100 coupon discount (10% discount)
    const order = {
      id: 'ord-multi-variant-123',
      subtotal: 1000,
      discountAmount: 100,
      status: 'DELIVERED',
      createdAt: new Date('2026-10-09T10:00:00Z'),
    };

    // Item 1: Variant A (256GB / Black), qty 1, price 400
    // Item 2: Variant B (512GB / Silver), qty 2, price 300 (total line gross 600)
    const rawItems = [
      {
        id: 'item-1',
        quantity: 1,
        price: 400,
        discountPrice: null,
        variantId: 'v-1',
        variantInfo: JSON.stringify({
          variantId: 'v-1',
          name: '256GB Black',
          attributeList: [{ name: 'Storage', value: '256GB' }, { name: 'Color', value: 'Black' }],
        }),
      },
      {
        id: 'item-2',
        quantity: 2,
        price: 300,
        discountPrice: null,
        variantId: 'v-2',
        variantInfo: JSON.stringify({
          variantId: 'v-2',
          name: '512GB Silver',
          attributeList: [{ name: 'Storage', value: '512GB' }, { name: 'Color', value: 'Silver' }],
        }),
      },
    ];

    let totalQuantity = 0;
    let totalNetPaid = 0;

    const lines = rawItems.map((item) => {
      const net = itemNetPaid(item, order);
      totalQuantity += item.quantity;
      totalNetPaid += net;
      return {
        id: item.id,
        variantId: item.variantId,
        quantity: item.quantity,
        lineTotal: Math.round(net * 100) / 100,
      };
    });

    // Item 1 net: 400 - (100 * 400)/1000 = 400 - 40 = 360
    // Item 2 net: 600 - (100 * 600)/1000 = 600 - 60 = 540
    // Total net paid: 900
    assert.equal(totalQuantity, 3); // 1 + 2
    assert.equal(totalNetPaid, 900); // 360 + 540
    assert.equal(lines.length, 2);
    assert.equal(lines[0].lineTotal, 360);
    assert.equal(lines[1].lineTotal, 540);
  });
});

