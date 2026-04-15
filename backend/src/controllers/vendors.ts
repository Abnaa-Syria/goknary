import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { NotFoundError } from '../lib/errors';
import { VendorStatus } from '@prisma/client';

export const getVendorBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const vendor = await prisma.vendor.findUnique({
      where: { slug },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!vendor || vendor.status !== 'APPROVED') {
      throw new NotFoundError('Vendor not found');
    }

    res.json(vendor);
  } catch (error: any) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching vendor:', error);
    res.status(500).json({ error: 'Failed to fetch vendor' });
  }
};

export const getVendorProducts = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { page = '1', limit = '24' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const vendor = await prisma.vendor.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!vendor) {
      throw new NotFoundError('Vendor not found');
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: {
          vendorId: vendor.id,
          status: 'ACTIVE',
        },
        include: {
          category: {
            select: {
              name: true,
              slug: true,
            },
          },
          brand: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limitNum,
      }),
      prisma.product.count({
        where: {
          vendorId: vendor.id,
          status: 'ACTIVE',
        },
      }),
    ]);

    res.json({
      products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching vendor products:', error);
    res.status(500).json({ error: 'Failed to fetch vendor products' });
  }
};

export const getVendors = async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '12' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where = {
      status: 'APPROVED' as VendorStatus,
    };

    const [vendors, total] = await Promise.all([
      prisma.vendor.findMany({
        where,
        select: {
          id: true,
          storeName: true,
          slug: true,
          description: true,
          rating: true,
          banner: true,
          logo: true,
        },
        orderBy: {
          storeName: 'asc',
        },
        skip,
        take: limitNum,
      }),
      prisma.vendor.count({ where }),
    ]);

    res.json({
      vendors,
      pagination: {
        totalCount: total,
        currentPage: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({ error: 'Failed to synchronize vendor directory' });
  }
};
