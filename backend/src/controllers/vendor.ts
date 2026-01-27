import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { ValidationError, NotFoundError } from '../lib/errors';
import { z } from 'zod';
import { slugify } from '../lib/utils';

const applyForVendorSchema = z.object({
  storeName: z.string().min(2),
  description: z.string().optional(),
});

const updateVendorSchema = z.object({
  storeName: z.string().min(2).optional(),
  description: z.string().optional(),
  logo: z.string().optional(),
  banner: z.string().optional(),
}).partial();

export const applyForVendor = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { storeName, description } = applyForVendorSchema.parse(req.body);

    // Check if user already has a vendor account
    const existingVendor = await prisma.vendor.findUnique({
      where: { userId: req.user.id },
    });

    if (existingVendor) {
      return res.status(400).json({ error: 'You already have a vendor account' });
    }

    // Check if store name is taken
    const slug = slugify(storeName);
    const existingSlug = await prisma.vendor.findUnique({
      where: { slug },
    });

    if (existingSlug) {
      return res.status(400).json({ error: 'Store name is already taken' });
    }

    // Create vendor application
    const vendor = await prisma.vendor.create({
      data: {
        userId: req.user.id,
        storeName,
        slug,
        description,
        status: 'PENDING',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    res.status(201).json({
      message: 'Vendor application submitted successfully. Waiting for approval.',
      vendor,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Error applying for vendor:', error);
    res.status(500).json({ error: 'Failed to submit vendor application' });
  }
};

export const getVendorProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user.id },
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
      throw new NotFoundError('Vendor profile not found');
    }

    res.json({ vendor });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching vendor profile:', error);
    res.status(500).json({ error: 'Failed to fetch vendor profile' });
  }
};

export const updateVendorProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const updateData = updateVendorSchema.parse(req.body);

    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user.id },
    });

    if (!vendor) {
      throw new NotFoundError('Vendor profile not found');
    }

    // If store name is being updated, check if new slug is available
    if (updateData.storeName && updateData.storeName !== vendor.storeName) {
      const newSlug = slugify(updateData.storeName);
      const existingSlug = await prisma.vendor.findUnique({
        where: { slug: newSlug },
      });

      if (existingSlug && existingSlug.id !== vendor.id) {
        return res.status(400).json({ error: 'Store name is already taken' });
      }

      updateData.slug = newSlug as any;
    }

    const updated = await prisma.vendor.update({
      where: { id: vendor.id },
      data: updateData,
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

    res.json({ vendor: updated });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Error updating vendor profile:', error);
    res.status(500).json({ error: 'Failed to update vendor profile' });
  }
};

