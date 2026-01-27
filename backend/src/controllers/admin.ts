import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { NotFoundError } from '../lib/errors';

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    // Total users
    const totalUsers = await prisma.user.count();

    // Total vendors
    const totalVendors = await prisma.vendor.count({
      where: { status: 'APPROVED' },
    });

    // Pending vendors
    const pendingVendors = await prisma.vendor.count({
      where: { status: 'PENDING' },
    });

    // Total products
    const totalProducts = await prisma.product.count();

    // Total orders
    const totalOrders = await prisma.order.count();

    // Total sales
    const salesResult = await prisma.order.aggregate({
      where: {
        status: { not: 'CANCELLED' },
      },
      _sum: {
        total: true,
      },
    });

    const totalSales = salesResult._sum.total || 0;

    // Recent orders
    const recentOrders = await prisma.order.findMany({
      take: 10,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        vendor: {
          select: {
            storeName: true,
          },
        },
      },
    });

    res.json({
      stats: {
        totalUsers,
        totalVendors,
        pendingVendors,
        totalProducts,
        totalOrders,
        totalSales,
      },
      recentOrders: recentOrders.map((order) => ({
        ...order,
        address: JSON.parse(order.addressJson),
      })),
    });
  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
};

export const getAdminOrderById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        items: {
          include: {
            product: {
              include: {
                vendor: {
                  select: {
                    storeName: true,
                    slug: true,
                  },
                },
                category: {
                  select: {
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
        vendor: {
          select: {
            id: true,
            storeName: true,
            slug: true,
          },
        },
        statusHistory: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    res.json({
      ...order,
      address: JSON.parse(order.addressJson),
      items: order.items.map((item) => ({
        ...item,
        product: {
          ...item.product,
          images: typeof item.product.images === 'string'
            ? JSON.parse(item.product.images)
            : item.product.images,
        },
      })),
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
};

