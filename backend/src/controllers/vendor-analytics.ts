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

    if (vendor.status !== 'APPROVED') {
      return res.status(403).json({ error: 'Vendor account is not approved or is suspended' });
    }

    const { period = '30' } = req.query; // days
    // M-11 Fix: bound period to prevent OOM from querying decades of data
    const periodDays = Math.min(Math.max(parseInt(period as string, 10) || 30, 1), 365);
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

    // 30-day time-series buckets (ensures no gaps in chart data)
    const salesByDay: { date: string; orders: number; sales: number }[] = [];
    for (let i = 0; i < periodDays; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (periodDays - 1 - i));
      const dateKey = d.toISOString().slice(0, 10);
      salesByDay.push({ date: dateKey, orders: 0, sales: 0 });
    }

    ordersForSales.forEach((order) => {
      const dateKey = order.createdAt.toISOString().slice(0, 10);
      const bucket = salesByDay.find((b) => b.date === dateKey);
      if (bucket) {
        bucket.orders += 1;
        bucket.sales += order.total;
      }
    });

    // Sort to be safe (though already sequential from loop)
    const sortedSalesByDay = salesByDay;

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

    const topProducts  = Array.from(topProductsMap.values())
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

