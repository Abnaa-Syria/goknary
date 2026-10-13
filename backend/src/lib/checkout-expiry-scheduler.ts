import { prisma } from './prisma';
import { getCheckoutExpiryBatchSize, getCheckoutExpirySweepMinutes } from './checkout-expiry-config';
import { unpaidCheckoutAttemptStates } from '../services/checkout-lifecycle.service';
import { processExpiredCheckoutAttempt } from '../services/checkout-expiry.service';

const STARTUP_DELAY_MS = 10_000;

export const runCheckoutExpirySweep = async (
  now: Date = new Date(),
  processor: typeof processExpiredCheckoutAttempt = processExpiredCheckoutAttempt,
) => {
  const batchSize = getCheckoutExpiryBatchSize();
  const candidates = await prisma.checkoutAttempt.findMany({
    where: {
      paymentMethod: 'KASHIER',
      status: { in: unpaidCheckoutAttemptStates },
      expiresAt: { not: null, lte: now },
    },
    select: { id: true },
    orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
    take: batchSize,
  });

  const summary = { scanned: candidates.length, cancelled: 0, paid: 0, pending: 0, unknown: 0, skipped: 0, failed: 0 };
  for (const candidate of candidates) {
    try {
      const result = await processor(candidate.id, { now });
      if (result.outcome === 'CANCELLED') summary.cancelled += 1;
      else if (result.outcome === 'PAID') summary.paid += 1;
      else if (result.outcome === 'PENDING') summary.pending += 1;
      else if (result.outcome === 'UNKNOWN') summary.unknown += 1;
      else summary.skipped += 1;
    } catch (error) {
      summary.failed += 1;
      console.error(
        `[checkout-expiry] attempt ${candidate.id} failed:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
  return summary;
};

let scheduledIntervalMinutes = 0;
let running = false;

export const getCheckoutExpiryScheduledMinutes = () => scheduledIntervalMinutes;

export const startCheckoutExpiryScheduler = (env: NodeJS.ProcessEnv = process.env) => {
  const minutes = getCheckoutExpirySweepMinutes(env);
  scheduledIntervalMinutes = minutes;
  if (!minutes) return null;

  const run = async (reason: string) => {
    if (running) return;
    running = true;
    try {
      const summary = await runCheckoutExpirySweep();
      if (summary.scanned > 0 || summary.failed > 0) {
        console.log(`[checkout-expiry] ${reason} sweep`, summary);
      }
    } catch (error) {
      console.error(`[checkout-expiry] ${reason} sweep failed:`, error instanceof Error ? error.message : error);
    } finally {
      running = false;
    }
  };

  const startup = setTimeout(() => void run('startup'), STARTUP_DELAY_MS);
  const interval = setInterval(() => void run('scheduled'), minutes * 60_000);
  startup.unref();
  interval.unref();
  return {
    stop: () => {
      clearTimeout(startup);
      clearInterval(interval);
    },
  };
};
