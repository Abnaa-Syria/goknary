import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { NotFoundError } from '../lib/errors';
import { ProductStatus } from '@prisma/client';

/**
 * Fetch all orders across the ecosystem (Admin Paginated View)
 */
export const getAdminOrders = async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '10', status } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          user: { select: { name: true, email: true } },
          vendor: { select: { storeName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      orders: orders.map(order => ({
        ...order,
        address: (() => { try { return JSON.parse(order.addressJson); } catch { return {}; } })(),
      })),
      pagination: {
        totalCount: total,
        currentPage: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching admin orders:', error);
    res.status(500).json({ error: 'Failed to synchronize ecosystem order history' });
  }
};

/**
 * Fetch all users with advanced filtering and pagination
 */
export const getUsers = async (req: Request, res: Response) => {
  try {
    const { q, role, status, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    // Search by name or email
    if (q) {
      where.OR = [
        { name: { contains: q as string } },
        { email: { contains: q as string } },
      ];
    }

    // Filter by role
    if (role && role !== 'all') {
      where.role = role;
    }

    // Filter by vendor status (if applicable)
    if (status && status !== 'all') {
      where.vendor = {
        status: status,
      };
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          phone: true,
          createdAt: true,
          vendor: {
            select: {
              id: true,
              storeName: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to synchronize user ecosystem' });
  }
};

/**
 * Update user identity and administrative role
 */
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, role } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError('User not found');

    const updated = await prisma.user.update({
      where: { id },
      data: { name, email, role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    res.json({ message: 'User updated successfully', user: updated });
  } catch (error) {
    if (error instanceof NotFoundError) return res.status(404).json({ error: error.message });
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user identity' });
  }
};

/**
 * Force reset user password by administrator
 */
export const forceResetPassword = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError('User not found');

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    res.json({ message: 'User password reset successfully' });
  } catch (error) {
    if (error instanceof NotFoundError) return res.status(404).json({ error: error.message });
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'Failed to override security credentials' });
  }
};

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    // Run all count queries in parallel for better performance
    const [
      totalUsers,
      totalVendors,
      pendingVendors,
      approvedVendors,
      totalProducts,
      activeProducts,
      totalOrders,
      salesResult,
      recentOrders,
      topVendors,
      ordersByStatus,
      last6MonthsOrders,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.vendor.count(),
      prisma.vendor.count({ where: { status: 'PENDING' } }),
      prisma.vendor.count({ where: { status: 'APPROVED' } }),
      prisma.product.count(),
      prisma.product.count({ where: { status: 'ACTIVE' } }),
      prisma.order.count(),
      prisma.order.aggregate({
        where: { status: { not: 'CANCELLED' } },
        _sum: { total: true },
      }),
      // Recent 10 orders for activity feed
      prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, email: true } },
          vendor: { select: { storeName: true } },
        },
      }),
      // Top 5 vendors by total revenue
      prisma.order.groupBy({
        by: ['vendorId'],
        where: { status: { not: 'CANCELLED' } },
        _sum: { total: true },
        _count: { id: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 5,
      }),
      // Orders grouped by status for the pie chart
      prisma.order.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      // Orders from the last 6 months (for trend chart)
      prisma.order.findMany({
        where: {
          createdAt: {
            gte: new Date(new Date().setMonth(new Date().getMonth() - 6)),
          },
          status: { not: 'CANCELLED' },
        },
        select: { createdAt: true, total: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const totalSales = salesResult._sum.total || 0;

    // Build monthly revenue trends (last 6 months)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const trendsMap = new Map<string, { revenue: number; orders: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      trendsMap.set(key, { revenue: 0, orders: 0 });
    }
    last6MonthsOrders.forEach((order) => {
      const d = new Date(order.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const entry = trendsMap.get(key);
      if (entry) {
        entry.revenue += order.total;
        entry.orders += 1;
      }
    });
    const revenueTrends = Array.from(trendsMap.entries()).map(([key, value]) => {
      const [year, month] = key.split('-').map(Number);
      return {
        name: monthNames[month],
        revenue: Math.round(value.revenue),
        orders: value.orders,
      };
    });

    // Resolve vendor names for top vendors
    const topVendorIds = topVendors.map((v) => v.vendorId);
    const vendorDetails = await prisma.vendor.findMany({
      where: { id: { in: topVendorIds } },
      select: { id: true, storeName: true, slug: true },
    });
    const vendorMap = new Map(vendorDetails.map((v) => [v.id, v]));
    const topVendorsResolved = topVendors.map((v) => ({
      id: v.vendorId,
      storeName: vendorMap.get(v.vendorId)?.storeName || 'Unknown',
      slug: vendorMap.get(v.vendorId)?.slug || '',
      revenue: Math.round(v._sum.total || 0),
      orders: v._count.id,
    }));

    res.json({
      stats: {
        totalUsers,
        totalVendors,
        pendingVendors,
        approvedVendors,
        totalProducts,
        activeProducts,
        totalOrders,
        totalSales: Math.round(totalSales),
      },
      revenueTrends,
      ordersByStatus: ordersByStatus.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
      topVendors: topVendorsResolved,
      recentOrders: recentOrders.map((order) => ({
        ...order,
        address: (() => { try { return JSON.parse(order.addressJson); } catch { return {}; } })(),
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

/**
 * Fetch all products for a specific vendor (Admin Master Catalog View)
 */
export const getAdminVendorProducts = async (req: Request, res: Response) => {
  try {
    const { vendorId } = req.params;
    const { page = '1', limit = '20', status } = req.query; // <-- extract status
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { vendorId };

    // Guard: only apply status filter if it's a non-empty, valid enum value
    const allowedStatuses = Object.values(ProductStatus) as string[];
    if (status && status !== 'all' && allowedStatuses.includes(status as string)) {
      where.status = status as ProductStatus;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { name: true } },
          brand: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      products,
      pagination: {
        totalCount: total,
        currentPage: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Error fetching admin vendor products:', error);
    res.status(500).json({ 
      error: 'Failed to synchronize vendor catalog master view',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Update product listing status (Governance Approval/Rejection)
 */
export const updateProductStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    // R-09 Resilient State Transition Bridge
    let finalStatus = status;
    const allowed = Object.values(ProductStatus) as string[];
    
    // Explicit Fallback mappings for in-flight migrations
    if (status === 'APPROVED' && !allowed.includes('APPROVED') && allowed.includes('ACTIVE')) {
      finalStatus = 'ACTIVE';
    } else if (status === 'ACTIVE' && !allowed.includes('ACTIVE') && allowed.includes('APPROVED')) {
      finalStatus = 'APPROVED';
    } else if (status === 'REJECTED' && !allowed.includes('REJECTED') && allowed.includes('INACTIVE')) {
      finalStatus = 'INACTIVE';
    }

    if (!allowed.includes(finalStatus as string)) {
      console.warn(`Admin State Override Failed: Request ${status} -> Evaluated ${finalStatus}. Allowed:`, allowed);
      return res.status(400).json({ 
        error: 'Invalid product status ecosystem value',
        details: { sent: status, evaluated: finalStatus, allowedValues: allowed }
      });
    }

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundError('Product not found in master catalog');

    const updated = await prisma.product.update({
      where: { id },
      data: { status: finalStatus as ProductStatus },
    });

    res.json({ 
      message: `Product status successfully updated to ${status}`, 
      product: updated 
    });
  } catch (error) {
    if (error instanceof NotFoundError) return res.status(404).json({ error: error.message });
    console.error('Error updating product status:', error);
    res.status(500).json({ error: 'Failed to override product lifecycle state' });
  }
};

/**
 * Permanently purge a product from the master catalog
 */
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundError('Product not found for decommissioning');

    // Deleting product will cascade if relations are set up, or require manual Cleanup
    await prisma.product.delete({ where: { id } });

    res.json({ message: 'Product successfully purged from the ecosystem' });
  } catch (error) {
    if (error instanceof NotFoundError) return res.status(404).json({ error: error.message });
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to decommission product entity' });
  }
};
