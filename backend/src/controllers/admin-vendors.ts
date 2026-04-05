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

    res.json({
      vendors,
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

    res.json({ vendor });
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

    const updated = await prisma.vendor.update({
      where: { id },
      data: {
        status: 'APPROVED',
        verified: true,
      },
    });

    res.json({
      message: 'Vendor approved successfully',
      vendor: updated,
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

