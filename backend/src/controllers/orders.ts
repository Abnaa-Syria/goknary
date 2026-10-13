import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { NotFoundError, ValidationError } from '../lib/errors';
import { z } from 'zod';
import { formatPrice } from '../lib/utils';
import { sendOrderPlacedNotification } from '../services/whatsapp.service';
import { NotificationType, notifyAdmins, notifyVendor, notifyVendorOrderStatus, shortId } from '../lib/notify';
import { withoutPaymentReferences } from '../lib/payment-reference';
import {
  buildVariantSnapshot,
  cancelOrderWithStockRestore,
  getUnitPrice,
  reserveStock,
  resolveVariant,
} from '../lib/variants';
import { trackPurchasesForOrders } from '../lib/user-events';
import { allocateShippingCost, calculateCheckoutShipping } from '../lib/shipping';
import { calculateCheckoutExpiresAt } from '../lib/checkout-expiry-config';
import { Prisma } from '@prisma/client';
import {
  IDEMPOTENCY_KEY_REUSE,
  assertMatchingFingerprint,
  createCheckoutAtomically,
  createCheckoutAttemptIdentity,
  fingerprintCheckout,
  readIdempotencyKey,
} from '../lib/checkout-idempotency';
import { findAndEvaluateCoupon } from '../lib/coupons';

const createOrderSchema = z.object({
  addressId: z.string().optional(),
  address: z.any().optional(),
  shippingMethod: z.string().default('Standard').optional(),
  notes: z.string().optional(),
  couponCode: z.string().optional(),
  items: z.array(z.object({
    productId: z.string(),
    variantId: z.string().optional().nullable(),
    quantity: z.number().int().positive(),
    // Ignored: prices are always read from the database
    price: z.number().optional()
  })),
  paymentMethod: z.string().optional(),
  paymentStatus: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

// Helper to read guest session id (same header used by cart controller)
const getSessionId = (req: Request): string | null => {
  return (req.headers['x-session-id'] as string | undefined) || null;
};

export const createOrder = async (req: AuthRequest, res: Response) => {
  let userId = '';
  let idempotencyKey = '';
  let requestFingerprint = '';
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    userId = req.user.id;
    
    // Explicit parsing with Zod bounds
    const { address, shippingMethod, couponCode, items, notes, paymentMethod, idempotencyKey: bodyKey } = createOrderSchema.parse(req.body);
    const normalizedPaymentMethod = String(paymentMethod || 'COD').toUpperCase() === 'KASHIER' ? 'KASHIER' : 'COD';
    const initialOrderStatus = normalizedPaymentMethod === 'COD' ? 'CONFIRMED' : 'PENDING';
    idempotencyKey = readIdempotencyKey(req.headers['idempotency-key'], bodyKey);
    requestFingerprint = fingerprintCheckout({
      address,
      shippingMethod,
      couponCode,
      items,
      notes,
      paymentMethod: normalizedPaymentMethod,
    });
    console.log(`Creating order: userId=${userId} itemCount=${items?.length ?? 0} paymentMethod=${normalizedPaymentMethod}`);

    const cartWhere = { userId };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    const existingAttempt = await prisma.checkoutAttempt.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
      include: {
        orders: {
          include: {
            items: { include: { product: true } },
            vendor: { select: { storeName: true, slug: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (existingAttempt) {
      assertMatchingFingerprint(existingAttempt.requestFingerprint, requestFingerprint);
      return res.status(200).json({
        message: 'Existing checkout returned',
        checkoutAttemptId: existingAttempt.id,
        idempotentReplay: true,
        orders: existingAttempt.orders.map((order) => ({
          ...order,
          address: (() => { try { return JSON.parse(order.addressJson); } catch { return {}; } })(),
        })),
      });
    }

    // Map strict backend products from frontend payload definitions
    const productIds = items.map(item => item.productId);
    const productsData = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        vendor: true,
      },
    });

    const productMap = new Map(productsData.map(p => [p.id, p]));

    // Construct exactly what the calculation sequence expects.
    // For products with variants, the selected variant is the source of truth for price and stock.
    const cartItems = [];
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) throw new ValidationError(`Mapped Product ${item.productId} could not be resolved`);

      const resolution = await resolveVariant(prisma, product, item.variantId);
      if (!resolution.ok) throw new ValidationError(resolution.message);
      const variant = resolution.variant;

      cartItems.push({
        id: 'runtime-checkout-payload',
        productId: item.productId,
        quantity: item.quantity,
        product,
        variant,
        priceSource: variant ?? product,
        label: variant ? `${product.name} (${variant.name})` : product.name,
      });
    }

    // Evaluate Global Subtotals for accurate promotional deductions
    const globalSubtotal = cartItems.reduce((acc, item) => {
      return acc + (getUnitPrice(item.priceSource) * item.quantity);
    }, 0);

    let globalDiscount = 0;
    let appliedCoupon = null;
    if (couponCode) {
      const evaluation = await findAndEvaluateCoupon(prisma, couponCode, globalSubtotal);
      appliedCoupon = evaluation.coupon;
      globalDiscount = evaluation.discountAmount;
    }

    // Group items by vendor
    const itemsByVendor = new Map<string, typeof cartItems>();
    cartItems.forEach((item) => {
      const vendorId = item.product.vendorId;
      if (!itemsByVendor.has(vendorId)) {
        itemsByVendor.set(vendorId, []);
      }
      itemsByVendor.get(vendorId)!.push(item);
    });

    // Get address
    let orderAddress = address;
    if (!orderAddress) {
      // Fallback if needed, though frontend sends it
      return res.status(400).json({ error: 'Address is required' });
    }

    // Fetch free shipping threshold from settings
    const thresholdSetting = await prisma.setting.findUnique({
      where: { key: 'free_shipping_threshold' }
    });
    const freeShippingThreshold = thresholdSetting ? parseFloat(thresholdSetting.value) : 500;

    const governorate = typeof orderAddress.state === 'string' ? orderAddress.state.trim() : '';
    const shippingRate = governorate
      ? await prisma.shippingRate.findFirst({
          where: { governorate, isActive: true },
          select: { cost: true },
        })
      : null;
    const checkoutShippingCost = calculateCheckoutShipping(
      globalSubtotal,
      Number.isFinite(freeShippingThreshold) ? freeShippingThreshold : 500,
      shippingRate?.cost,
    );
    const vendorEntries = Array.from(itemsByVendor.entries());
    const vendorSubtotals = vendorEntries.map(([, vendorItems]) =>
      vendorItems.reduce(
        (subtotal, item) => subtotal + (getUnitPrice(item.priceSource) * item.quantity),
        0,
      ),
    );
    const shippingAllocations = allocateShippingCost(checkoutShippingCost, vendorSubtotals);

    const preparedOrders = vendorEntries.map(([vendorId, vendorItems], vendorIndex) => {
      // Calculate totals
      let subtotal = 0;
      const orderItemsData = vendorItems.map((item) => {
        const price = getUnitPrice(item.priceSource);
        const itemTotal = price * item.quantity;
        subtotal += itemTotal;

        // Check stock
        const availableStock = item.variant ? item.variant.stock : item.product.stock;
        if (availableStock < item.quantity) {
          throw new ValidationError(`Insufficient stock for ${item.label}`);
        }

        return {
          productId: item.productId,
          variantId: item.variant?.id ?? null,
          variantInfo: item.variant ? buildVariantSnapshot(item.variant) : null,
          quantity: item.quantity,
          price: item.priceSource.price,
          discountPrice: item.priceSource.discountPrice,
        };
      });

      const orderShare = globalSubtotal > 0 ? (subtotal / globalSubtotal) : 0;
      const orderDiscountAmount = globalDiscount * orderShare;

      const shippingCost = shippingAllocations[vendorIndex] ?? 0;
      const total = (subtotal - orderDiscountAmount) + shippingCost;

      return { vendorId, vendorItems, subtotal, orderItemsData, orderDiscountAmount, shippingCost, total };
    });

    const identity = createCheckoutAttemptIdentity();
    const expiresAt = normalizedPaymentMethod === 'KASHIER' ? calculateCheckoutExpiresAt() : null;
    const checkout = await createCheckoutAtomically(prisma, {
      attempt: {
        ...identity,
        userId,
        idempotencyKey,
        requestFingerprint,
        paymentMethod: normalizedPaymentMethod,
        status: normalizedPaymentMethod === 'COD' ? 'COMPLETED' : 'ORDERS_CREATED',
        expiresAt,
      },
      orders: preparedOrders.map((prepared) => ({
        stockLines: prepared.vendorItems.map((item) => ({
          productId: item.productId,
          variantId: item.variant?.id ?? null,
          quantity: item.quantity,
          label: item.label,
        })),
        data: {
            userId,
            vendorId: prepared.vendorId,
            status: initialOrderStatus,
            subtotal: prepared.subtotal,
            shippingCost: prepared.shippingCost,
            total: prepared.total,
            couponCode: appliedCoupon?.code || null,
            discountAmount: prepared.orderDiscountAmount,
            addressJson: JSON.stringify(orderAddress),
            shippingMethod: shippingMethod || 'Standard',
            notes,
            paymentMethod: normalizedPaymentMethod,
            paymentStatus: 'PENDING',
            items: {
              create: prepared.orderItemsData,
            },
            statusHistory: {
              create: {
                status: initialOrderStatus,
                notes: normalizedPaymentMethod === 'COD'
                  ? 'COD order confirmed'
                  : 'Kashier order created, awaiting payment confirmation',
              },
            },
          },
        include: {
            items: {
              include: {
                product: true,
              },
            },
            vendor: {
              select: {
                storeName: true,
                slug: true,
              },
            },
          },
      })),
      coupon: appliedCoupon,
      clearCartWhere: normalizedPaymentMethod === 'COD' ? cartWhere : null,
    }, reserveStock);

    const orders = checkout.orders;

    for (const order of orders) {

      // COD orders are confirmed at creation; Kashier purchases are tracked on the verified paid webhook.
      if (normalizedPaymentMethod === 'COD') {
        void trackPurchasesForOrders([order.id]);
      }

      // --- PHASE 1: VENDOR NOTIFICATION ---
      await notifyVendor(order.vendorId, {
        type: NotificationType.ORDER_CREATED,
        title: 'New Order Received!',
        titleAr: 'طلب جديد!',
        message: `You have received a new order (${order.id}) totaling ${formatPrice(order.total)}.`,
        messageAr: `وصلك طلب جديد (#${shortId(order.id)}) بإجمالي ${formatPrice(order.total)}.`,
        link: `/vendor/orders/${order.id}`,
        entityType: 'ORDER',
        entityId: order.id,
      });

      // --- PHASE 1.5: CUSTOMER WHATSAPP NOTIFICATION ---
      try {
        const customer = await prisma.user.findUnique({
          where: { id: userId },
          select: { phone: true, name: true }
        });
        if (customer?.phone && customer?.name) {
          sendOrderPlacedNotification(
            customer.phone,
            customer.name,
            order.id,
            order.total
          ).catch((err) => console.error('Failed to send WhatsApp order notification:', err));
        }
      } catch (err) {
        console.error('Failed to dispatch customer WhatsApp order notification', err);
      }
    }

    // --- PHASE 1: ADMIN NOTIFICATIONS ---
    await notifyAdmins({
      type: NotificationType.ORDER_CREATED,
      title: 'New Platform Transaction',
      titleAr: 'عملية شراء جديدة على المنصة',
      message: `A new order flow was completed. ${orders.length} sub-orders generated.`,
      messageAr: `تم إتمام طلب جديد، وتم إنشاء ${orders.length} طلب فرعي.`,
      link: orders.length === 1 ? `/admin/orders/${orders[0].id}` : '/admin/orders',
      entityType: 'ORDER',
      entityId: orders.length === 1 ? orders[0].id : undefined,
    });

    res.status(201).json({
      message: 'Order created successfully',
      checkoutAttemptId: checkout.attempt.id,
      idempotentReplay: false,
      orders: orders.map((order: any) => ({
        ...order,
        // H-09 Fix: safe JSON.parse — malformed addressJson won't crash the endpoint
        address: (() => { try { return JSON.parse(order.addressJson); } catch { return {}; } })(),
      })),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && userId && idempotencyKey) {
      const existingAttempt = await prisma.checkoutAttempt.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey } },
        include: {
          orders: {
            include: {
              items: { include: { product: true } },
              vendor: { select: { storeName: true, slug: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      if (existingAttempt) {
        if (existingAttempt.requestFingerprint !== requestFingerprint) {
          return res.status(409).json({
            error: IDEMPOTENCY_KEY_REUSE,
            message: 'This idempotency key was already used with a different checkout payload',
          });
        }
        return res.status(200).json({
          message: 'Existing checkout returned',
          checkoutAttemptId: existingAttempt.id,
          idempotentReplay: true,
          orders: existingAttempt.orders.map((order) => ({
            ...order,
            address: (() => { try { return JSON.parse(order.addressJson); } catch { return {}; } })(),
          })),
        });
      }
    }
    if (error instanceof Error && error.name === IDEMPOTENCY_KEY_REUSE) {
      return res.status(409).json({ error: IDEMPOTENCY_KEY_REUSE, message: error.message });
    }
    if (error instanceof z.ZodError || (error as any).name === 'ZodError') {
      console.log("VALIDATION ERROR:", error);
      return res.status(400).json({ message: "Validation Failed", details: (error as any).errors || error });
    }
    if (error instanceof ValidationError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error creating order:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown Database Error',
      message: 'Failed to create order' 
    });
  }
};

export const getOrders = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.user.id;

    const { page = '1', limit = '10' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  nameAr: true,
                  slug: true,
                  images: true,
                  imageMetadata: true,
                },
              },
            },
          },
          vendor: {
            select: {
              storeName: true,
              storeNameAr: true,
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
      prisma.order.count({ where: { userId } }),
    ]);

    res.json({
      orders: orders.map((order) => ({
        ...withoutPaymentReferences(order),
        address: (() => { try { return JSON.parse(order.addressJson); } catch { return {}; } })(),
        items: order.items.map((item) => ({
          ...item,
          product: {
            ...item.product,
            images: typeof item.product.images === 'string'
              ? JSON.parse(item.product.images)
              : item.product.images,
          },
        })),
      })),
      pagination: {
        totalCount: total,
        currentPage: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown Database Error' 
    });
  }
};

export const getOrderById = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.user.id;
    const { id } = req.params;

    const order = await prisma.order.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                vendor: {
                  select: {
                    storeName: true,
                    storeNameAr: true,
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
            refundRequests: { select: { id: true, status: true, quantity: true, amount: true, createdAt: true } },
          },
        },
        vendor: {
          select: {
            storeName: true,
            storeNameAr: true,
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
      ...withoutPaymentReferences(order),
      // H-09 Fix: safe JSON.parse — a corrupt addressJson won't crash the endpoint
      address: (() => { try { return JSON.parse(order.addressJson); } catch { return {}; } })(),
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

export const cancelOrder = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const userId = req.user.id;

    // Verify order ownership and status
    const order = await prisma.order.findFirst({
      where: { id, userId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    if (!['PENDING', 'CONFIRMED', 'PROCESSING'].includes(order.status)) {
      throw new ValidationError(`Order cannot be cancelled in its current state: ${order.status}`);
    }

    // Atomic transaction: update status + increment stock + add history
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const cancelled = await cancelOrderWithStockRestore(tx, id, ['PENDING', 'CONFIRMED', 'PROCESSING']);
      if (!cancelled) {
        throw new ValidationError('Order cannot be cancelled in its current state');
      }
      const updated = await tx.order.findUniqueOrThrow({ where: { id } });

      // Add to history
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          status: 'CANCELLED',
          notes: 'Order cancelled by customer',
        },
      });

      return updated;
    });

    await notifyVendorOrderStatus(updatedOrder.vendorId, id, 'CANCELLED', {
      en: `The customer cancelled order #${shortId(id)}.`,
      ar: `العميل ألغى الطلب رقم #${shortId(id)}.`,
    });

    res.json({ message: 'Order cancelled successfully', order: withoutPaymentReferences(updatedOrder) });
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error cancelling order:', error);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
};

/**
 * Deprecated: used to mark the whole order REFUNDED without any refund or stock movement.
 * Kept so older clients get a clear answer; returns now go through POST /api/refunds per item.
 */
export const returnOrder = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const order = await prisma.order.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      select: { id: true },
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    res.status(410).json({
      error: 'Whole-order returns are no longer supported. Request a return for each item from the order page.',
      errorAr: 'إرجاع الطلب بالكامل لم يعد متاحاً. اطلب إرجاع كل منتج من صفحة الطلب.',
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error requesting return:', error);
    res.status(500).json({ error: 'Failed to request return' });
  }
};

export const getOrderStatusHistory = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const userId = req.user.id;

    // Check if user is owner or admin or vendor of this order
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        vendor: true,
      },
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    const isOwner = order.userId === userId;
    const isAdmin = req.user.role === 'ADMIN';
    const isVendor = req.user.role === 'VENDOR' && order.vendorId === req.user.id; // User.id is used for vendor lookup in some contexts

    // Fix: correct vendor check if req.user.id is for user, we need to check vendor table
    let authorized = isOwner || isAdmin;
    if (!authorized && req.user.role === 'VENDOR') {
      const vendor = await prisma.vendor.findUnique({ where: { userId: req.user.id } });
      if (vendor && order.vendorId === vendor.id) {
        authorized = true;
      }
    }

    if (!authorized) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const history = await prisma.orderStatusHistory.findMany({
      where: { orderId: id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ history });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching order status history:', error);
    res.status(500).json({ error: 'Failed to fetch order history' });
  }
};
