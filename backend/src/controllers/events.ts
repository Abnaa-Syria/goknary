import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { publicProductWhere } from '../lib/visibility';
import { isClientTrackableEventType, isUserEventType, trackUserEvent } from '../lib/user-events';

const idSchema = z.string().trim().min(1).max(191);

// Any other body field (userId, vendorId, metadata, ...) is ignored: the user comes from the token
// and every reference is resolved on the server.
const clientEventSchema = z.object({
  type: z.string(),
  productId: idSchema.optional(),
  categoryId: idSchema.optional(),
});

// POST /api/events — client-side events (page views) for logged-in customers only.
export const recordClientEvent = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const parsed = clientEventSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid event payload' });
    }
    const { type, productId, categoryId } = parsed.data;

    if (!isUserEventType(type)) {
      return res.status(400).json({ error: 'Unknown event type' });
    }
    if (!isClientTrackableEventType(type)) {
      return res.status(400).json({ error: 'This event type can only be recorded by the server' });
    }

    if (type === 'PRODUCT_VIEW') {
      if (!productId) return res.status(400).json({ error: 'productId is required' });
      const product = await prisma.product.findFirst({
        where: publicProductWhere({ id: productId }),
        select: { id: true, categoryId: true, vendorId: true },
      });
      if (!product) return res.status(404).json({ error: 'Product not found' });

      await trackUserEvent({
        userId: req.user.id,
        type,
        productId: product.id,
        categoryId: product.categoryId,
        vendorId: product.vendorId,
      });
      return res.status(204).end();
    }

    if (!categoryId) return res.status(400).json({ error: 'categoryId is required' });
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!category) return res.status(404).json({ error: 'Category not found' });

    await trackUserEvent({ userId: req.user.id, type, categoryId: category.id });
    return res.status(204).end();
  } catch {
    // Tracking must never surface as a user-facing failure.
    console.error('[user-events] Failed to handle client event');
    return res.status(204).end();
  }
};
