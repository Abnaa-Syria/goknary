import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { NotFoundError } from '../lib/errors';
import { z } from 'zod';

const addressSchema = z.object({
  label: z.string().min(1),
  fullName: z.string().min(1),
  phone: z.string().min(1),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().optional(),
  postalCode: z.string().min(1),
  country: z.string().default('Egypt'),
  isDefault: z.boolean().default(false),
});

export const getAddresses = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const addresses = await prisma.address.findMany({
      where: { userId: req.user.id },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    res.json({ addresses });
  } catch (error) {
    console.error('Error fetching addresses:', error);
    res.status(500).json({ error: 'Failed to fetch addresses' });
  }
};

export const createAddress = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const addressData = addressSchema.parse(req.body);

    // If this is set as default, unset other defaults
    if (addressData.isDefault) {
      await prisma.address.updateMany({
        where: { userId: req.user.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    const address = await prisma.address.create({
      data: {
        ...addressData,
        userId: req.user.id,
      },
    });

    res.status(201).json({ address });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Error creating address:', error);
    res.status(500).json({ error: 'Failed to create address' });
  }
};

export const updateAddress = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const addressData = addressSchema.partial().parse(req.body);

    // Verify address belongs to user
    const existingAddress = await prisma.address.findFirst({
      where: {
        id,
        userId: req.user.id,
      },
    });

    if (!existingAddress) {
      throw new NotFoundError('Address not found');
    }

    // If setting as default, unset other defaults
    if (addressData.isDefault) {
      await prisma.address.updateMany({
        where: {
          userId: req.user.id,
          id: { not: id },
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    const address = await prisma.address.update({
      where: { id },
      data: addressData,
    });

    res.json({ address });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Error updating address:', error);
    res.status(500).json({ error: 'Failed to update address' });
  }
};

export const deleteAddress = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    // Verify address belongs to user
    const address = await prisma.address.findFirst({
      where: {
        id,
        userId: req.user.id,
      },
    });

    if (!address) {
      throw new NotFoundError('Address not found');
    }

    await prisma.address.delete({
      where: { id },
    });

    res.json({ message: 'Address deleted successfully' });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error deleting address:', error);
    res.status(500).json({ error: 'Failed to delete address' });
  }
};

