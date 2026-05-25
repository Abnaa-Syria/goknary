import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { Prisma, VendorStatus } from '@prisma/client';
import { NotFoundError } from '../lib/errors';

export const getVendors = async (req: Request, res: Response) => {
  try {
    const { status, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // M-02 Fix: validate status param against Prisma enum — prevents silent empty results
    // from typos like ?status=HACKED
    const where: Prisma.VendorWhereInput = {};
    const validStatusValues = Object.values(VendorStatus);
    if (status && validStatusValues.includes(status as VendorStatus)) {
      where.status = status as VendorStatus;
    } else if (status) {
      return res.status(400).json({
        error: `Invalid status value. Must be one of: ${validStatusValues.join(', ')}`,
      });
    }

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

    const vendorIds = vendors.map((v) => v.id);

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

    res.json({
      vendors: vendorsWithStats,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
};

export const getVendorById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
          },
        },
      },
    });

    if (!vendor) {
      throw new NotFoundError('Vendor not found');
    }

    const [
      totalOrders,
      totalProducts,
      salesResult,
      ordersByStatusRaw,
      recentOrders,
      products,
    ] = await Promise.all([
      prisma.order.count({ where: { vendorId: id } }),
      prisma.product.count({ where: { vendorId: id } }),
      prisma.order.aggregate({
        where: { vendorId: id, status: { not: 'CANCELLED' } },
        _sum: { total: true },
      }),
      prisma.order.groupBy({
        by: ['status'],
        where: { vendorId: id },
        _count: { id: true },
      }),
      prisma.order.findMany({
        where: { vendorId: id },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, email: true } },
        },
      }),
      prisma.product.findMany({
        where: { vendorId: id },
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { name: true } },
          brand: { select: { name: true } },
        },
      }),
    ]);

    const totalSales = salesResult._sum.total || 0;
    const commissionRate = vendor.commissionRate ?? 10;
    const commissionAmount = Math.round(totalSales * (commissionRate / 100) * 100) / 100;
    const netEarnings = Math.round((totalSales - commissionAmount) * 100) / 100;

    const ordersByStatus = ordersByStatusRaw.map((s) => ({
      status: s.status,
      count: s._count.id,
    }));

    res.json({
      vendor,
      stats: {
        totalOrders,
        totalProducts,
        totalSales: Math.round(totalSales * 100) / 100,
        commissionRate,
        commissionAmount,
        netEarnings,
      },
      ordersByStatus,
      recentOrders: recentOrders.map((order) => ({
        ...order,
        address: (() => {
          try {
            return JSON.parse(order.addressJson);
          } catch {
            return {};
          }
        })(),
      })),
      products: products.map((product) => ({
        ...product,
        images: (() => {
          try {
            return JSON.parse(product.images);
          } catch {
            return [];
          }
        })(),
      })),
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching vendor:', error);
    res.status(500).json({ error: 'Failed to fetch vendor' });
  }
};

export const approveVendor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const vendor = await prisma.vendor.findUnique({
      where: { id },
    });

    if (!vendor) {
      throw new NotFoundError('Vendor not found');
    }

    // V-01 Fix: Use transaction to ensure User.role is elevated to VENDOR upon approval
    const result = await prisma.$transaction(async (tx) => {
      const updatedVendor = await tx.vendor.update({
        where: { id },
        data: {
          status: 'APPROVED',
          verified: true,
        },
      });

      await tx.user.update({
        where: { id: vendor.userId },
        data: { role: 'VENDOR' },
      });

      return updatedVendor;
    });

    res.json({
      message: 'Vendor approved successfully and user role updated to VENDOR',
      vendor: result,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error approving vendor:', error);
    res.status(500).json({ error: 'Failed to approve vendor' });
  }
};

export const rejectVendor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const vendor = await prisma.vendor.findUnique({
      where: { id },
    });

    if (!vendor) {
      throw new NotFoundError('Vendor not found');
    }

    const updated = await prisma.vendor.update({
      where: { id },
      data: {
        status: 'REJECTED',
      },
    });

    res.json({
      message: 'Vendor rejected',
      vendor: updated,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error rejecting vendor:', error);
    res.status(500).json({ error: 'Failed to reject vendor' });
  }
};

export const suspendVendor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const vendor = await prisma.vendor.findUnique({
      where: { id },
    });

    if (!vendor) {
      throw new NotFoundError('Vendor not found');
    }

    const updated = await prisma.vendor.update({
      where: { id },
      data: {
        status: 'SUSPENDED',
      },
    });

    res.json({
      message: 'Vendor suspended',
      vendor: updated,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error suspending vendor:', error);
    res.status(500).json({ error: 'Failed to suspend vendor' });
  }
};

/**
 * Unified vendor status management (Approve, Reject, Suspend)
 */
export const updateVendorStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatusValues = Object.values(VendorStatus);
    if (!status || !validStatusValues.includes(status as VendorStatus)) {
      return res.status(400).json({
        error: `Invalid status value. Must be one of: ${validStatusValues.join(', ')}`,
      });
    }

    const vendor = await prisma.vendor.findUnique({ where: { id } });
    if (!vendor) throw new NotFoundError('Vendor not found');

    // V-01 Fix: Use transaction for consistent Role/Status updates
    const result = await prisma.$transaction(async (tx) => {
      const updatedVendor = await tx.vendor.update({
        where: { id },
        data: { 
          status: status as VendorStatus,
          verified: status === 'APPROVED' ? true : vendor.verified
        },
      });

      if (status === 'APPROVED') {
        await tx.user.update({
          where: { id: vendor.userId },
          data: { role: 'VENDOR' },
        });
      }

      return updatedVendor;
    });

    res.json({
      message: `Vendor status updated to ${status}${status === 'APPROVED' ? ' and user role elevated to VENDOR' : ''}`,
      vendor: result,
    });
  } catch (error) {
    if (error instanceof NotFoundError) return res.status(404).json({ error: error.message });
    console.error('Error updating vendor status:', error);
    res.status(500).json({ error: 'Failed to synchronize vendor lifecycle' });
  }
};

