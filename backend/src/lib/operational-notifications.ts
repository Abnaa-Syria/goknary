import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { NotificationType } from './notify';

export const operationalConfig = () => ({
  intervalMinutes: Math.max(1, Number(process.env.OPERATIONAL_ALERT_INTERVAL_MINUTES) || 15),
  batchSize: Math.min(500, Math.max(1, Number(process.env.OPERATIONAL_ALERT_BATCH_SIZE) || 100)),
  cooldownHours: Math.max(1, Number(process.env.OPERATIONAL_ALERT_COOLDOWN_HOURS) || 24),
  pendingHours: Math.max(1, Number(process.env.ORDER_SLA_PENDING_HOURS) || 24),
  confirmedHours: Math.max(1, Number(process.env.ORDER_SLA_CONFIRMED_HOURS) || 24),
  processingHours: Math.max(1, Number(process.env.ORDER_SLA_PROCESSING_HOURS) || 48),
});

export const operationalBucket = (now: Date, cooldownHours: number) =>
  Math.floor(now.getTime() / (cooldownHours * 60 * 60 * 1000));

export const isOrderOverdue = (
  order: { status: string; updatedAt: Date },
  now: Date,
  thresholds: Record<string, number>,
) => {
  const hours = thresholds[order.status];
  return hours != null && order.updatedAt.getTime() <= now.getTime() - hours * 60 * 60 * 1000;
};

const createOncePerBucket = async (input: {
  userId: string;
  key: string;
  type: string;
  title: string;
  message: string;
  titleAr: string;
  messageAr: string;
  link: string;
  entityType: string;
  entityId: string;
}, now: Date, cooldownHours: number) => {
  const id = createHash('sha256')
    .update(`${input.key}:${operationalBucket(now, cooldownHours)}`)
    .digest('hex');
  try {
    await prisma.notification.create({ data: { id, userId: input.userId, type: input.type, title: input.title,
      message: input.message, titleAr: input.titleAr, messageAr: input.messageAr,
      link: input.link, entityType: input.entityType, entityId: input.entityId } });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return false;
    throw error;
  }
};

type LowStockRow = {
  entityId: string;
  productId: string;
  vendorUserId: string;
  productName: string;
  variantName: string | null;
  stock: number;
  threshold: number;
};

export async function runOperationalNotifications(now = new Date()) {
  const config = operationalConfig();
  const lowStock = await prisma.$queryRaw<LowStockRow[]>`
    SELECT p.id AS entityId, p.id AS productId, v.user_id AS vendorUserId,
           p.name AS productName, NULL AS variantName, p.stock AS stock,
           p.low_stock_threshold AS threshold
    FROM products p JOIN vendors v ON v.id = p.vendor_id
    WHERE p.status IN ('ACTIVE', 'APPROVED') AND v.status = 'APPROVED'
      AND p.stock <= p.low_stock_threshold
    UNION ALL
    SELECT pv.id AS entityId, p.id AS productId, v.user_id AS vendorUserId,
           p.name AS productName, pv.name AS variantName, pv.stock AS stock,
           p.low_stock_threshold AS threshold
    FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      JOIN vendors v ON v.id = p.vendor_id
    WHERE pv.status = 1 AND p.status IN ('ACTIVE', 'APPROVED') AND v.status = 'APPROVED'
      AND pv.stock <= p.low_stock_threshold
    ORDER BY stock ASC
    LIMIT ${config.batchSize}
  `;

  let lowStockCreated = 0;
  for (const row of lowStock) {
    const label = row.variantName ? `${row.productName} / ${row.variantName}` : row.productName;
    if (await createOncePerBucket({
      userId: row.vendorUserId,
      key: `LOW_STOCK:${row.entityId}`,
      type: NotificationType.LOW_STOCK,
      title: `Low stock: ${label}`,
      titleAr: `مخزون منخفض: ${label}`,
      message: `${row.stock} unit(s) remain; your alert threshold is ${row.threshold}.`,
      messageAr: `المتبقي ${row.stock} وحدة، وحد التنبيه ${row.threshold}.`,
      link: `/vendor/products/${row.productId}`,
      entityType: row.variantName ? 'PRODUCT_VARIANT' : 'PRODUCT',
      entityId: row.entityId,
    }, now, config.cooldownHours)) lowStockCreated++;
  }

  const orders = await prisma.order.findMany({
    where: { status: { in: ['PENDING', 'CONFIRMED', 'PROCESSING'] } },
    orderBy: { updatedAt: 'asc' },
    take: config.batchSize,
    select: { id: true, vendorId: true, status: true, updatedAt: true, vendor: { select: { userId: true } } },
  });
  const thresholds = { PENDING: config.pendingHours, CONFIRMED: config.confirmedHours, PROCESSING: config.processingHours };
  const overdue = orders.filter((order) => isOrderOverdue(order, now, thresholds));
  const admins = overdue.length
    ? await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } })
    : [];
  let slaCreated = 0;
  for (const order of overdue) {
    for (const userId of [order.vendor.userId, ...admins.map((admin) => admin.id)]) {
      if (await createOncePerBucket({
        userId,
        key: `ORDER_SLA:${order.id}:${userId}`,
        type: NotificationType.ORDER_SLA,
        title: `Order needs attention (#${order.id.slice(-8).toUpperCase()})`,
        titleAr: `طلب يحتاج متابعة (#${order.id.slice(-8).toUpperCase()})`,
        message: `Order is still ${order.status.toLowerCase()} beyond its configured SLA.`,
        messageAr: `الطلب ما زال في حالة ${order.status} بعد تجاوز مدة المتابعة المحددة.`,
        link: userId === order.vendor.userId ? `/vendor/orders/${order.id}` : `/admin/orders/${order.id}`,
        entityType: 'ORDER',
        entityId: order.id,
      }, now, config.cooldownHours)) slaCreated++;
    }
  }
  return { lowStockCandidates: lowStock.length, lowStockCreated, slaCandidates: overdue.length, slaCreated };
}

let timer: NodeJS.Timeout | null = null;
let running = false;

export function startOperationalNotificationScheduler() {
  if (process.env.NODE_ENV === 'test' || process.env.DISABLE_OPERATIONAL_ALERTS === 'true' || timer) return false;
  const interval = operationalConfig().intervalMinutes * 60_000;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const result = await runOperationalNotifications();
      if (result.lowStockCreated || result.slaCreated) console.log('Operational notifications:', result);
    } catch (error) {
      console.error('Operational notification run failed:', error instanceof Error ? error.message : error);
    } finally {
      running = false;
    }
  };
  timer = setInterval(() => void run(), interval);
  timer.unref?.();
  void run();
  return true;
}

