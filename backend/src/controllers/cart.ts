import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import { formatVariantForResponse, getUnitPrice, resolveVariant } from '../lib/variants';
import { trackCustomerEventFromRequest } from '../lib/user-events';

// Helper to get session ID from request (for guest users)
const getSessionId = (req: Request): string | null => {
  // For now, we'll use a cookie or generate one
  // In production, you'd use express-session or similar
  return req.headers['x-session-id'] as string | undefined || null;
};

const addToCartSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional().nullable(),
  quantity: z.number().int().positive().default(1),
});

const parseImages = (images: unknown) =>
  typeof images === 'string' ? JSON.parse(images) : images;

const formatCartItemVariant = (variant: { attributes: unknown } | null | undefined) =>
  variant ? formatVariantForResponse(variant) : null;

export const getCart = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id || null;
    const sessionId = userId ? null : getSessionId(req);

    if (!userId && !sessionId) {
      return res.json({ items: [], total: 0 });
    }

    const cartItems = await prisma.cartItem.findMany({
      where: userId ? { userId } : { sessionId },
      include: {
        product: {
          include: {
            vendor: {
              select: {
                id: true,
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
        variant: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Legacy rows (added before variants were tracked) have no variantId. They may fall back
    // to the product's single active default variant; otherwise the customer must re-select.
    const legacyProductIds = Array.from(new Set(
      cartItems.filter((item) => item.product.hasVariants && !item.variantId).map((item) => item.productId)
    ));
    const defaultVariantByProduct = new Map<string, (typeof cartItems)[number]['variant']>();
    const productsWithVariantRows = new Set<string>();
    if (legacyProductIds.length > 0) {
      const legacyVariants = await prisma.productVariant.findMany({
        where: { productId: { in: legacyProductIds } },
      });
      for (const productId of legacyProductIds) {
        const productVariants = legacyVariants.filter((v) => v.productId === productId);
        if (productVariants.length > 0) productsWithVariantRows.add(productId);
        const defaults = productVariants.filter((v) => v.isDefault && v.status);
        if (defaults.length === 1) defaultVariantByProduct.set(productId, defaults[0]);
      }
    }

    // Calculate totals
    let subtotal = 0;
    const items = cartItems.map((item) => {
      const autoSelectedVariant = !item.variantId && item.product.hasVariants
        ? defaultVariantByProduct.get(item.productId) ?? null
        : null;
      const variant = item.product.hasVariants ? (item.variant ?? autoSelectedVariant) : null;
      const requiresVariantSelection = item.product.hasVariants && !variant
        && (!!item.variantId || productsWithVariantRows.has(item.productId));
      const unavailable = !!variant && !variant.status;
      const priceSource = variant ?? item.product;
      const purchasable = !requiresVariantSelection && !unavailable;

      const itemTotal = purchasable ? getUnitPrice(priceSource) * item.quantity : 0;
      subtotal += itemTotal;

      return {
        id: item.id,
        product: {
          ...item.product,
          images: parseImages(item.product.images),
        },
        variantId: variant?.id ?? null,
        variant: formatCartItemVariant(variant),
        variantAutoSelected: !!autoSelectedVariant,
        requiresVariantSelection,
        unavailable,
        availableStock: variant ? variant.stock : item.product.stock,
        quantity: item.quantity,
        price: priceSource.price,
        discountPrice: priceSource.discountPrice,
        itemTotal,
      };
    });

    res.json({
      items,
      subtotal: Math.round(subtotal * 100) / 100,
      total: Math.round(subtotal * 100) / 100, // Shipping will be added in checkout
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    });
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
};

export const addToCart = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id || null;
    const sessionId = userId ? null : getSessionId(req);

    const { productId, variantId: requestedVariantId, quantity } = addToCartSchema.parse(req.body);

    // Verify product exists and is available
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product || !['ACTIVE', 'APPROVED'].includes(product.status)) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const resolution = await resolveVariant(prisma, product, requestedVariantId);
    if (!resolution.ok) {
      return res.status(400).json({ error: resolution.message, code: resolution.code });
    }
    const variant = resolution.variant;
    const variantId = variant?.id ?? null;
    const availableStock = variant ? variant.stock : product.stock;

    if (availableStock < quantity) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }

    // The same product in a different variant is a separate cart line
    const existingItem = await prisma.cartItem.findFirst({
      where: {
        productId,
        variantId,
        ...(userId ? { userId } : { sessionId }),
      },
    });

    const cartItemInclude = {
      product: {
        include: {
          vendor: {
            select: {
              storeName: true,
              slug: true,
            },
          },
        },
      },
      variant: true,
    };

    let cartItem;
    let addedQuantity = quantity;
    if (existingItem) {
      // Update quantity
      const newQuantity = Math.min(existingItem.quantity + quantity, availableStock);
      addedQuantity = newQuantity - existingItem.quantity;
      cartItem = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity },
        include: cartItemInclude,
      });
    } else {
      // Create new cart item
      if (!userId && !sessionId) {
        // Generate session ID if guest user
        const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        // In production, set this as a cookie
        res.setHeader('X-Session-Id', newSessionId);
        cartItem = await prisma.cartItem.create({
          data: {
            sessionId: newSessionId,
            productId,
            variantId,
            quantity,
          },
          include: cartItemInclude,
        });
      } else {
        cartItem = await prisma.cartItem.create({
          data: {
            userId: userId || undefined,
            sessionId: sessionId || undefined,
            productId,
            variantId,
            quantity,
          },
          include: cartItemInclude,
        });
      }
    }

    if (addedQuantity > 0) {
      trackCustomerEventFromRequest(req, {
        type: 'ADD_TO_CART',
        productId,
        categoryId: product.categoryId,
        vendorId: product.vendorId,
        metadata: { variantId, quantity: addedQuantity, source: 'add_to_cart' },
      });
    }

    res.json({
      message: 'Item added to cart',
      item: {
        ...cartItem,
        product: {
          ...cartItem.product,
          images: parseImages(cartItem.product.images),
        },
        variant: formatCartItemVariant(cartItem.variant),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Error adding to cart:', error);
    res.status(500).json({ error: 'Failed to add item to cart' });
  }
};

export const updateCartItem = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id || null;
    const sessionId = userId ? null : getSessionId(req);
    const { id } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ error: 'Quantity must be at least 1' });
    }

    // Verify cart item belongs to user/session
    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id,
        ...(userId ? { userId } : { sessionId }),
      },
      include: {
        product: true,
        variant: true,
      },
    });

    if (!cartItem) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    if (cartItem.variant && !cartItem.variant.status) {
      return res.status(400).json({ error: 'This option is no longer available', code: 'VARIANT_INACTIVE' });
    }

    const availableStock = cartItem.variant ? cartItem.variant.stock : cartItem.product.stock;
    if (quantity > availableStock) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }

    const updated = await prisma.cartItem.update({
      where: { id },
      data: { quantity },
      include: {
        product: {
          include: {
            vendor: {
              select: {
                storeName: true,
                slug: true,
              },
            },
          },
        },
        variant: true,
      },
    });

    // A quantity change in the cart is tracked as adding/removing the difference.
    const quantityDelta = updated.quantity - cartItem.quantity;
    if (quantityDelta !== 0) {
      trackCustomerEventFromRequest(req, {
        type: quantityDelta > 0 ? 'ADD_TO_CART' : 'REMOVE_FROM_CART',
        productId: cartItem.productId,
        categoryId: cartItem.product.categoryId,
        vendorId: cartItem.product.vendorId,
        metadata: { variantId: cartItem.variantId, quantity: Math.abs(quantityDelta), source: 'cart_quantity' },
      });
    }

    res.json({
      message: 'Cart item updated',
      item: {
        ...updated,
        product: {
          ...updated.product,
          images: parseImages(updated.product.images),
        },
        variant: formatCartItemVariant(updated.variant),
      },
    });
  } catch (error) {
    console.error('Error updating cart item:', error);
    res.status(500).json({ error: 'Failed to update cart item' });
  }
};

export const removeCartItem = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id || null;
    const sessionId = userId ? null : getSessionId(req);
    const { id } = req.params;

    // Verify cart item belongs to user/session
    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id,
        ...(userId ? { userId } : { sessionId }),
      },
    });

    if (!cartItem) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    await prisma.cartItem.delete({
      where: { id },
    });

    trackCustomerEventFromRequest(req, {
      type: 'REMOVE_FROM_CART',
      productId: cartItem.productId,
      metadata: { variantId: cartItem.variantId, quantity: cartItem.quantity, source: 'remove_item' },
    });

    res.json({ message: 'Item removed from cart' });
  } catch (error) {
    console.error('Error removing cart item:', error);
    res.status(500).json({ error: 'Failed to remove cart item' });
  }
};

export const clearCart = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id || null;
    const sessionId = userId ? null : getSessionId(req);

    if (!userId && !sessionId) {
      return res.json({ message: 'Cart is already empty' });
    }

    await prisma.cartItem.deleteMany({
      where: userId ? { userId } : { sessionId },
    });

    res.json({ message: 'Cart cleared' });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
};

/**
 * Merges a guest cart into a user's permanent cart.
 * Called upon successful login or OTP verification.
 */
export const mergeGuestCartIntoUserCart = async (sessionId: string, userId: string) => {
  try {
    // 1. Fetch guest items
    const guestItems = await prisma.cartItem.findMany({
      where: { sessionId },
    });

    if (guestItems.length === 0) return;

    // 2. Perform merge in a transaction for data integrity
    await prisma.$transaction(async (tx) => {
      for (const item of guestItems) {
        // Check if product already exists in user's cart
        const existingUserItem = await tx.cartItem.findFirst({
          where: {
            userId,
            productId: item.productId,
            variantId: item.variantId,
          },
        });

        if (existingUserItem) {
          // Increment quantity
          await tx.cartItem.update({
            where: { id: existingUserItem.id },
            data: { quantity: existingUserItem.quantity + item.quantity },
          });
          // Delete the guest item
          await tx.cartItem.delete({ where: { id: item.id } });
        } else {
          // Move item to user
          await tx.cartItem.update({
            where: { id: item.id },
            data: {
              userId,
              sessionId: null, // Detach from session
            },
          });
        }
      }
    });

    console.log(`Successfully merged cart for session ${sessionId} into user ${userId}`);
  } catch (error) {
    console.error('Failed to merge guest cart:', error);
    // Keep login/verification from reporting success until the guest cart is safely merged.
    throw error;
  }
};
