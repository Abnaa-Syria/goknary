import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { ValidationError, NotFoundError } from '../lib/errors';
import { z } from 'zod';
import { slugify } from '../lib/utils';
import { Prisma } from '@prisma/client';

const SLUG_TAKEN_MESSAGE = 'Store URL is already in use';

const isSlugUniqueViolation = (error: unknown): boolean => {
  const e = error as Partial<Prisma.PrismaClientKnownRequestError> | null;
  return e?.code === 'P2002' && String(e.meta?.target ?? '').includes('slug');
};

const applyForVendorSchema = z.object({
  storeName: z.string().min(2),
  description: z.string().optional(),
});

export const POLICY_MAX_LENGTH = 5000;
export const RETURN_WINDOW_MAX_DAYS = 365;

// Omitted = keep the stored value; empty string or null = clear it.
const policyText = z
  .string()
  .max(POLICY_MAX_LENGTH, `Policy text must be at most ${POLICY_MAX_LENGTH} characters`)
  .nullable()
  .optional()
  .transform((v) => (v === undefined ? undefined : v?.trim() || null));

const updateVendorSchema = z.object({
  storeName: z.string().min(2).optional(),
  description: z.string().optional(),
  logo: z.string().optional(),
  banner: z.string().optional(),
  slug: z.string().optional(),
  returnPolicy: policyText,
  returnPolicyAr: policyText,
  shippingPolicy: policyText,
  shippingPolicyAr: policyText,
  exchangePolicy: policyText,
  exchangePolicyAr: policyText,
  returnWindowDays: z
    .number({ invalid_type_error: 'returnWindowDays must be a whole number' })
    .int('returnWindowDays must be a whole number')
    .min(0, 'returnWindowDays cannot be negative')
    .max(RETURN_WINDOW_MAX_DAYS, `returnWindowDays cannot exceed ${RETURN_WINDOW_MAX_DAYS}`)
    .nullable()
    .optional(),
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

      updateData.slug = newSlug;
    } else if (updateData.slug !== undefined) {
      // slugify falls back to a random value for input without letters/digits; reject that instead.
      if (!/[\p{L}\p{N}]/u.test(updateData.slug)) {
        return res.status(400).json({ error: 'Invalid store URL' });
      }
      const requestedSlug = slugify(updateData.slug);
      if (requestedSlug === vendor.slug) {
        delete updateData.slug;
      } else {
        const existingSlug = await prisma.vendor.findUnique({ where: { slug: requestedSlug }, select: { id: true } });
        if (existingSlug && existingSlug.id !== vendor.id) {
          return res.status(400).json({ error: SLUG_TAKEN_MESSAGE });
        }
        updateData.slug = requestedSlug;
      }
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
    // A concurrent update can claim the slug between the pre-check and the write.
    if (isSlugUniqueViolation(error)) {
      return res.status(400).json({ error: SLUG_TAKEN_MESSAGE });
    }
    console.error('Error updating vendor profile:', error);
    res.status(500).json({ error: 'Failed to update vendor profile' });
  }
};

