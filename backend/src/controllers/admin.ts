import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { NotFoundError } from '../lib/errors';
import { ProductStatus, OrderStatus, UserRole, VendorStatus } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { slugify } from '../lib/utils';
import { isCodOrder, isOrderFinanciallyConfirmed, settleOrderOnDelivery } from '../lib/vendor-earnings';
import { sendOrderStatusNotification } from '../services/whatsapp.service';

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
          customRole: {
            select: {
              id: true,
              name: true,
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
    const { name, email, role, customRoleId, vendorStatus } = req.body;

    const user = await prisma.user.findUnique({
      where: { id },
      include: { vendor: true },
    });
    if (!user) throw new NotFoundError('User not found');

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (role !== undefined) data.role = role;

    // Handle customRoleId based on role
    if (role === 'STAFF' && customRoleId) {
      data.customRoleId = customRoleId;
    } else if (role && role !== 'STAFF') {
      data.customRoleId = null; // Clear role assignment when leaving STAFF
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id },
        data,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          customRole: {
            select: { id: true, name: true },
          },
        },
      });

      if (role === 'VENDOR') {
        const status = vendorStatus || 'APPROVED';
        if (!user.vendor) {
          const storeName = name || user.name || 'Vendor Store';
          const slug = `${slugify(storeName)}-${Math.random().toString(36).substring(2, 7)}`;
          await tx.vendor.create({
            data: {
              userId: id,
              storeName,
              slug,
              status,
              verified: status === 'APPROVED',
            },
          });
        } else {
          await tx.vendor.update({
            where: { id: user.vendor.id },
            data: {
              status,
              verified: status === 'APPROVED' ? true : user.vendor.verified,
            },
          });
        }
      } else if (user.vendor && role !== undefined && role !== 'VENDOR') {
        // If they had a vendor record but their role was changed away from VENDOR, suspend the vendor record
        await tx.vendor.update({
          where: { id: user.vendor.id },
          data: {
            status: 'SUSPENDED',
          },
        });
      }

      return updatedUser;
    });

    res.json({ message: 'User updated successfully', user: updated });
  } catch (error) {
    if (error instanceof NotFoundError) return res.status(404).json({ error: error.message });
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user identity' });
  }
};

/**
 * Admin-created user (skips phone verification)
 */
const createUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  role: z.enum(['CUSTOMER', 'VENDOR', 'STAFF', 'ADMIN']),
  customRoleId: z.string().optional(),
});

export const createUser = async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, password, role, customRoleId } = createUserSchema.parse(req.body);

    // Check for existing email
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Validate customRoleId if role is STAFF
    if (role === 'STAFF') {
      if (!customRoleId) {
        return res.status(400).json({ error: 'Staff users must have a custom role assigned.' });
      }
      const roleExists = await prisma.customRole.findUnique({ where: { id: customRoleId } });
      if (!roleExists) {
        return res.status(404).json({ error: 'Custom role not found.' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        customRoleId: role === 'STAFF' ? customRoleId : null,
        phoneVerified: true,   // Admin-created users skip verification
        emailVerified: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        customRole: {
          select: { id: true, name: true },
        },
      },
    });

    res.status(201).json({ message: 'User created successfully', user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid user data', details: error.errors });
    }
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
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
    const settlementSetting = await prisma.platformSetting.findUnique({
      where: { key: 'settlementDate' },
    });
    const settlementDate = settlementSetting ? new Date(settlementSetting.value) : null;
    const dateFilter = settlementDate ? { createdAt: { gte: settlementDate } } : {};

    // Run all count queries in parallel for better performance
    const [
      totalUsers,
      totalVendors,
      pendingVendors,
      approvedVendors,
      totalProducts,
      pendingProducts,
      activeProducts,
      totalOrders,
      deliveredOrders,
      salesResult,
      recentOrders,
      topVendors,
      ordersByStatus,
      last6MonthsOrders,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'CUSTOMER', ...dateFilter } }),
      prisma.vendor.count({ where: { ...dateFilter } }),
      prisma.vendor.count({ where: { status: 'PENDING', ...dateFilter } }),
      prisma.vendor.count({ where: { status: 'APPROVED', ...dateFilter } }),
      prisma.product.count({ where: { ...dateFilter } }),
      prisma.product.count({ where: { status: 'PENDING', ...dateFilter } }),
      prisma.product.count({ where: { status: 'ACTIVE', ...dateFilter } }),
      prisma.order.count({ where: { ...dateFilter } }),
      prisma.order.count({ where: { status: 'DELIVERED', ...dateFilter } }),
      prisma.order.aggregate({
        where: { status: 'DELIVERED', ...dateFilter },
        _sum: { total: true },
      }),
      // Recent 10 orders for activity feed
      prisma.order.findMany({
        where: { ...dateFilter },
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
        where: { status: 'DELIVERED', ...dateFilter },
        _sum: { total: true },
        _count: { id: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 5,
      }),
      // Orders grouped by status for the pie chart
      prisma.order.groupBy({
        by: ['status'],
        where: { ...dateFilter },
        _count: { id: true },
      }),
      // Orders from the last 6 months (for trend chart)
      prisma.order.findMany({
        where: {
          createdAt: {
            gte: settlementDate 
              ? new Date(Math.max(new Date(new Date().setMonth(new Date().getMonth() - 6)).getTime(), settlementDate.getTime()))
              : new Date(new Date().setMonth(new Date().getMonth() - 6)),
          },
          status: 'DELIVERED',
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
      settlementDate: settlementSetting ? settlementSetting.value : null,
      stats: {
        totalUsers,
        totalVendors,
        pendingVendors,
        approvedVendors,
        totalProducts,
        pendingProducts,
        activeProducts,
        totalOrders,
        deliveredOrders,
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
            refundRequest: true,
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
 * Fetch all vendor products waiting for administrative review.
 */
export const getPendingAdminProducts = async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20', q } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { status: ProductStatus.PENDING };
    if (q && (q as string).trim()) {
      const search = (q as string).trim();
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { vendor: { storeName: { contains: search } } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          vendor: {
            select: {
              id: true,
              storeName: true,
              slug: true,
              user: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
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
    console.error('Error fetching pending admin products:', error);
    res.status(500).json({
      error: 'Failed to synchronize pending product review queue',
      details: error.message,
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

    // Check if product has been purchased
    const orderCount = await prisma.orderItem.count({
      where: { productId: id },
    });

    if (orderCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete product because it has associated purchase history. You can deactivate it (mark as INACTIVE) instead.',
        errorAr: 'لا يمكن حذف المنتج لأنه مرتبط بعمليات شراء سابقة. يمكنك إلغاء تفعيله (جعله غير نشط) بدلاً من ذلك.',
      });
    }

    // Clean up dependent records and delete product in a transaction
    await prisma.$transaction([
      prisma.cartItem.deleteMany({ where: { productId: id } }),
      prisma.wishlistItem.deleteMany({ where: { productId: id } }),
      prisma.compareItem.deleteMany({ where: { productId: id } }),
      prisma.review.deleteMany({ where: { productId: id } }),
      prisma.productVariant.deleteMany({ where: { productId: id } }),
      prisma.product.delete({ where: { id } }),
    ]);

    res.json({ message: 'Product successfully purged from the ecosystem' });
  } catch (error) {
    if (error instanceof NotFoundError) return res.status(404).json({ error: error.message });
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to decommission product entity' });
  }
};

/**
 * Admin: Update order status and record in history
 */
export const updateAdminOrderStatus = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const validStatuses = Object.values(OrderStatus);
    if (!status || !validStatuses.includes(status as OrderStatus)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    if (status !== 'CANCELLED' && !isOrderFinanciallyConfirmed(order)) {
      return res.status(400).json({
        error: 'Online payment must be paid before processing this order',
        errorAr: 'يجب تأكيد الدفع الإلكتروني قبل معالجة هذا الطلب',
      });
    }

    // Update order status and create history entry in a transaction
    const updatedOrder = await prisma.$transaction(async (tx) => {
      if (status === 'DELIVERED' && order.status !== 'DELIVERED') {
        const vendor = await tx.vendor.findUnique({
          where: { id: order.vendorId },
        });
        if (vendor) {
          await settleOrderOnDelivery(tx, order, vendor);
        }
      }

      const updated = await tx.order.update({
        where: { id },
        data: {
          status: status as OrderStatus,
          ...(status === 'DELIVERED' && isCodOrder(order.paymentMethod)
            ? { paymentStatus: 'PAID' }
            : {}),
        },
        include: {
          user: { select: { name: true, email: true, phone: true } },
          vendor: { select: { storeName: true } },
          items: { include: { product: true } },
        }
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          status: status as OrderStatus,
          notes: notes || `Status updated by administrator (${req.user?.email})`,
        },
      });

      return updated;
    });

    // Send WhatsApp order status update notification to the customer
    if (updatedOrder.user && updatedOrder.user.phone && updatedOrder.user.name) {
      sendOrderStatusNotification(
        updatedOrder.user.phone,
        updatedOrder.user.name,
        updatedOrder.id,
        status
      ).catch((err) => console.error('Failed to send WhatsApp status notification from admin:', err));
    }

    res.json({
      message: `Order status updated to ${status}`,
      order: updatedOrder,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
};

/**
 * Admin: Create product under the platform's own "Vendor" account
 */
const platformProductSchema = z.object({
  categoryId: z.string(),
  brandId: z.string().optional().nullable(),
  name: z.string().min(1),
  nameAr: z.string().optional(),
  slug: z.string().optional().nullable(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  price: z.number().positive(),
  discountPrice: z.number().positive().optional().nullable(),
  stock: z.number().int().nonnegative(),
  images: z.array(z.string()).min(1),
});

export const createPlatformProduct = async (req: AuthRequest, res: Response) => {
  try {
    const data = platformProductSchema.parse(req.body);
    const PLATFORM_EMAIL = 'admin@goknary.com';

    // 1. Resolve or create Platform Vendor
    let platformVendor = await prisma.vendor.findFirst({
      where: { user: { email: PLATFORM_EMAIL } },
    });

    if (!platformVendor) {
      console.log('Initializing Platform Vendor account...');
      platformVendor = await prisma.$transaction(async (tx) => {
        let user = await tx.user.findUnique({ where: { email: PLATFORM_EMAIL } });
        
        if (!user) {
          user = await tx.user.create({
            data: {
              email: PLATFORM_EMAIL,
              name: 'GoKnary Platform',
              passwordHash: await bcrypt.hash(`PLATFORM_${Math.random()}`, 12),
              role: 'ADMIN',
              phoneVerified: true,
              emailVerified: true,
            },
          });
        }

        return await tx.vendor.create({
          data: {
            userId: user.id,
            storeName: 'GoKnary Official',
            slug: 'goknary-official',
            status: 'APPROVED',
            verified: true,
          },
        });
      });
    }

    // 2. Create the product
    const rawSlug = data.slug ? data.slug.trim() : '';
    const slug = rawSlug ? slugify(rawSlug) : slugify(data.name);
    const existingSlug = await prisma.product.findUnique({ where: { slug } });
    if (existingSlug) {
      return res.status(400).json({ error: 'Slug or product name is already taken' });
    }

    const productId = `plat_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const sku = `PLAT-${data.categoryId.substring(0, 3).toUpperCase()}-${productId.substring(productId.length - 6).toUpperCase()}`;

    const product = await prisma.product.create({
      data: {
        vendorId:      platformVendor.id,
        categoryId:    data.categoryId,
        brandId:       data.brandId || null,
        name:          data.name,
        nameAr:        data.nameAr || null,
        slug,
        description:   data.description || '',
        descriptionAr: data.descriptionAr || null,
        sku,
        price:         data.price,
        discountPrice: data.discountPrice ?? null,
        stock:         data.stock,
        images:        JSON.stringify(data.images),
        status:        'ACTIVE', // Platform products are automatically active
        featured:      true,
      },
    });

    res.status(201).json({
      message: 'Platform product created successfully',
      product: {
        ...product,
        images: data.images,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid product data', details: error.errors });
    }
    console.error('Error creating platform product:', error);
    res.status(500).json({ error: 'Failed to create platform product' });
  }
};

export const settlePlatform = async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user?.id || 'unknown';
    const adminEmail = req.user?.email || 'unknown';
    const settlementDate = new Date();

    const result = await prisma.$transaction(async (tx) => {
      // 1. Save or update PlatformSettings with key 'settlementDate'
      const setting = await tx.platformSetting.upsert({
        where: { key: 'settlementDate' },
        update: {
          value: settlementDate.toISOString(),
          updatedBy: adminEmail,
        },
        create: {
          key: 'settlementDate',
          value: settlementDate.toISOString(),
          updatedBy: adminEmail,
        },
      });

      // 2. Append history record
      const history = await tx.platformSettlement.create({
        data: {
          settlementDate,
          adminId,
          adminName: adminEmail,
        },
      });

      return { setting, history };
    });

    res.json({
      message: 'Platform statistics successfully reset / settled.',
      settlementDate: result.setting.value,
    });
  } catch (error) {
    console.error('Error settling platform statistics:', error);
    res.status(500).json({ error: 'Failed to settle platform statistics' });
  }
};
