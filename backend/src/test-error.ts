import { prisma } from './lib/prisma';
import { VendorStatus } from '@prisma/client';

async function test() {
  try {
    const status = undefined;
    const pageNum = 1;
    const limitNum = 10;
    const skip = 0;

    const where = {};

    const [vendors, total] = await Promise.all([
      prisma.vendor.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limitNum,
      }),
      prisma.vendor.count({ where }),
    ]);

    console.log('Vendors fetched:', vendors.length);
    const vendorIds = vendors.map((v) => v.id);
    console.log('Vendor IDs:', vendorIds);

    // Fetch totalSales and totalOrders count in a single groupBy query
    const salesStats = await prisma.order.groupBy({
      by: ['vendorId'],
      where: {
        vendorId: { in: vendorIds },
        status: { not: 'CANCELLED' },
      },
      _sum: {
        total: true,
      },
      _count: {
        id: true,
      },
    });

    console.log('Sales stats fetched:', salesStats);

    // Fetch totalProducts count in a single groupBy query
    const productsStats = await prisma.product.groupBy({
      by: ['vendorId'],
      where: {
        vendorId: { in: vendorIds },
      },
      _count: {
        id: true,
      },
    });

    console.log('Products stats fetched:', productsStats);

    const salesMap = new Map(
      salesStats.map((s) => [
        s.vendorId,
        { totalSales: s._sum.total || 0, totalOrders: s._count.id },
      ])
    );
    const productsMap = new Map(
      productsStats.map((p) => [p.vendorId, p._count.id])
    );

    const vendorsWithStats = vendors.map((vendor) => {
      const stats = salesMap.get(vendor.id) || { totalSales: 0, totalOrders: 0 };
      const productCount = productsMap.get(vendor.id) || 0;
      return {
        ...vendor,
        totalSales: Math.round(stats.totalSales * 100) / 100,
        totalOrders: stats.totalOrders,
        totalProducts: productCount,
      };
    });

    console.log('Successfully completed test!');
  } catch (error) {
    console.error('Test failed with error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
