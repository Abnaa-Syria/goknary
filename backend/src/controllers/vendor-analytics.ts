import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

export const getVendorAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user.id },
    });

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    const { period = '30' } = req.query; // days
    const periodDays = parseInt(period as string, 10);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    // Total orders
    const totalOrders = await prisma.order.count({
      where: {
        vendorId: vendor.id,
        createdAt: { gte: startDate },
      },
    });

    // Total sales
    const salesResult = await prisma.order.aggregate({
      where: {
        vendorId: vendor.id,
        createdAt: { gte: startDate },
        status: { not: 'CANCELLED' },
      },
      _sum: {
        total: true,
      },
    });

    const totalSales = salesResult._sum.total || 0;

    // Orders by status (safe aggregate in Prisma)
    const ordersByStatusRaw = await prisma.order.findMany({
      where: {
        vendorId: vendor.id,
        createdAt: { gte: startDate },
      },
      select: {
        status: true,
      },
    });

    const ordersByStatusMap = new Map<string, number>();
    ordersByStatusRaw.forEach((o) => {
      ordersByStatusMap.set(o.status, (ordersByStatusMap.get(o.status) || 0) + 1);
    });

    const ordersByStatus = Array.from(ordersByStatusMap.entries()).map(
      ([status, count]) => ({ status, count })
    );

    // Sales by day (aggregate in JS instead of raw SQL for portability)
    const ordersForSales = await prisma.order.findMany({
      where: {
        vendorId: vendor.id,
        createdAt: { gte: startDate },
        status: { not: 'CANCELLED' },
      },
      select: {
        createdAt: true,
        total: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const salesByDayMap = new Map<string, { date: string; orders: number; sales: number }>();
    ordersForSales.forEach((order) => {
      const dateKey = order.createdAt.toISOString().slice(0, 10); // YYYY-MM-DD
      const entry = salesByDayMap.get(dateKey) || {
        date: dateKey,
        orders: 0,
        sales: 0,
      };
      entry.orders += 1;
      entry.sales += order.total;
      salesByDayMap.set(dateKey, entry);
    });

    const salesByDay = Array.from(salesByDayMap.values()).sort(
      (a, b) => a.date.localeCompare(b.date)
    );

    // Top selling products (aggregate in JS to avoid groupBy relation constraints)
    const orderItemsForTopProducts = await prisma.orderItem.findMany({
      where: {
        order: {
          vendorId: vendor.id,
          createdAt: { gte: startDate },
          status: { not: 'CANCELLED' },
        },
      },
      select: {
        productId: true,
        quantity: true,
        product: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    });

    const topProductsMap = new Map<
      string,
      { product: { name: string | null; slug: string | null }; quantitySold: number }
    >();

    orderItemsForTopProducts.forEach((item) => {
      const existing = topProductsMap.get(item.productId) || {
        product: {
          name: item.product?.name ?? null,
          slug: item.product?.slug ?? null,
        },
        quantitySold: 0,
      };
      existing.quantitySold += item.quantity;
      topProductsMap.set(item.productId, existing);
    });

    const topProducts = Array.from(topProductsMap.values())
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 10);

    res.json({
      summary: {
        totalOrders,
        totalSales,
        period: `${periodDays} days`,
      },
      ordersByStatus,
      salesByDay,
      topProducts,
    });
  } catch (error) {
    console.error('Error fetching vendor analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};

