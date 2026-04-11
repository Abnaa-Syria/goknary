import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const shippingRateSchema = z.object({
  governorate: z.string().min(1),
  cost: z.number().nonnegative(),
  isActive: z.boolean().default(true),
});

// Public: Get all active rates for checkout
export const getActiveRates = async (_req: Request, res: Response) => {
  try {
    const rates = await prisma.shippingRate.findMany({
      where: { isActive: true },
      orderBy: { governorate: 'asc' },
    });
    res.json({ rates });
  } catch (error) {
    console.error('Error fetching shipping rates:', error);
    res.status(500).json({ error: 'Failed to fetch shipping rates' });
  }
};

// Admin: CRUD - Get all rates
export const getAllRates = async (_req: AuthRequest, res: Response) => {
  try {
    const rates = await prisma.shippingRate.findMany({
      orderBy: { governorate: 'asc' },
    });
    res.json({ rates });
  } catch (error) {
    console.error('Error fetching all shipping rates:', error);
    res.status(500).json({ error: 'Failed to fetch all shipping rates' });
  }
};

// Admin: CRUD - Create rate
export const createRate = async (req: AuthRequest, res: Response) => {
  try {
    const data = shippingRateSchema.parse(req.body);
    const rate = await prisma.shippingRate.create({
      data,
    });
    res.status(201).json({ rate });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors });
    }
    console.error('Error creating shipping rate:', error);
    res.status(500).json({ error: 'Failed to create shipping rate' });
  }
};

// Admin: CRUD - Update rate
export const updateRate = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = shippingRateSchema.partial().parse(req.body);
    const rate = await prisma.shippingRate.update({
      where: { id },
      data,
    });
    res.json({ rate });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors });
    }
    console.error('Error updating shipping rate:', error);
    res.status(500).json({ error: 'Failed to update shipping rate' });
  }
};

// Admin: CRUD - Delete rate
export const deleteRate = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.shippingRate.delete({
      where: { id },
    });
    res.json({ message: 'Shipping rate deleted successfully' });
  } catch (error) {
    console.error('Error deleting shipping rate:', error);
    res.status(500).json({ error: 'Failed to delete shipping rate' });
  }
};
