import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import {
  DEFAULT_RANKING_WEIGHTS,
  MAX_RANKING_WEIGHT,
  PRODUCT_SIGNAL_RULES,
  RANKING_LOOKBACK_DAYS,
  RANKING_WEIGHT_KEYS,
  RankingWeights,
  VENDOR_RANKING_WEIGHTS,
  rankingWeightsSchema,
} from '../lib/ranking-config';
import {
  RankingRecomputeInProgressError,
  getLastRecompute,
  getScheduledIntervalMinutes,
  isRecomputeRunning,
  loadRankingWeights,
  previewRanking as buildRankingPreview,
  recomputeRankingScores,
  saveRankingWeights,
} from '../lib/ranking';

const bodySchema = z.object({ weights: rankingWeightsSchema }).strict();

const parseWeights = (body: unknown): { weights: RankingWeights } | { error: { error: string; details: z.ZodIssue[] } } => {
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return { error: { error: 'Invalid ranking weights', details: parsed.error.errors } };
  return { weights: parsed.data.weights as RankingWeights };
};

// GET /api/admin/ranking-config
export const getRankingConfig = async (_req: AuthRequest, res: Response) => {
  try {
    const [{ weights, source }, lastRecompute] = await Promise.all([loadRankingWeights(), getLastRecompute()]);
    res.json({
      weights,
      defaults: DEFAULT_RANKING_WEIGHTS,
      keys: RANKING_WEIGHT_KEYS,
      maxWeight: MAX_RANKING_WEIGHT,
      source,
      lookbackDays: RANKING_LOOKBACK_DAYS,
      minViewsForConversion: PRODUCT_SIGNAL_RULES.MIN_VIEWS_FOR_RANKING_CONVERSION,
      vendorWeights: VENDOR_RANKING_WEIGHTS,
      recompute: {
        running: isRecomputeRunning(),
        intervalMinutes: getScheduledIntervalMinutes(),
        lastRun: lastRecompute,
      },
    });
  } catch (error) {
    console.error('Error fetching ranking config:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to load ranking configuration' });
  }
};

// PUT /api/admin/ranking-config — persist and apply the weights in the same admin action.
export const updateRankingConfig = async (req: AuthRequest, res: Response) => {
  const parsed = parseWeights(req.body);
  if ('error' in parsed) return res.status(400).json(parsed.error);
  try {
    await saveRankingWeights(parsed.weights);
    try {
      const summary = await recomputeRankingScores({ reason: 'weights-updated' });
      const applied = summary.status === 'success';
      return res.status(applied ? 200 : 202).json({
        message: applied
          ? 'Ranking configuration saved and product scores recomputed.'
          : 'Ranking configuration saved, but the score recompute did not finish completely.',
        weights: parsed.weights,
        recomputeRequired: !applied,
        summary,
      });
    } catch (error) {
      if (!(error instanceof RankingRecomputeInProgressError)) throw error;
    }
    res.status(202).json({
      message: 'Ranking configuration saved. A recompute is already running.',
      weights: parsed.weights,
      recomputeRequired: true,
    });
  } catch (error) {
    console.error('Error saving ranking config:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to save ranking configuration' });
  }
};

// POST /api/admin/ranking/recompute
export const recomputeRanking = async (_req: AuthRequest, res: Response) => {
  try {
    const summary = await recomputeRankingScores({ reason: 'manual' });
    res.status(summary.status === 'failed' ? 500 : 200).json({ summary });
  } catch (error) {
    if (error instanceof RankingRecomputeInProgressError) {
      return res.status(409).json({ error: 'A ranking recompute is already running. Try again shortly.' });
    }
    console.error('Error recomputing ranking:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to recompute ranking scores' });
  }
};

// POST /api/admin/ranking/preview — proposed weights in, top products with breakdown out; nothing persisted.
export const previewRanking = async (req: AuthRequest, res: Response) => {
  const parsed = parseWeights(req.body);
  if ('error' in parsed) return res.status(400).json(parsed.error);
  try {
    res.json(await buildRankingPreview(parsed.weights));
  } catch (error) {
    console.error('Error previewing ranking:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to preview ranking' });
  }
};
