import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { AuthRequest } from '../middleware/auth';
import {
  DISCOUNT_SUGGESTION_REASONS,
  DISCOUNT_SUGGESTION_STATUSES,
  SUGGESTION_LIST,
} from '../lib/discount-suggestion-config';
import {
  SuggestionGenerationInProgressError,
  decideDiscountSuggestion,
  generateDiscountSuggestions,
  getSuggestionIntervalHours,
  listDiscountSuggestions,
} from '../lib/discount-suggestions';

const listQuerySchema = z.object({
  status: z.enum(DISCOUNT_SUGGESTION_STATUSES).optional(),
  reason: z.enum(DISCOUNT_SUGGESTION_REASONS).optional(),
  vendorId: z.string().trim().min(1).max(64).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).default(SUGGESTION_LIST.DEFAULT_LIMIT).transform((n) => Math.min(n, SUGGESTION_LIST.MAX_LIMIT)),
});

// Only an action: the percentage cannot be changed here (a different discount goes through product edit).
const decisionSchema = z.object({ action: z.enum(['approve', 'reject']) }).strict();

const generateSchema = z
  .object({
    vendorId: z.string().trim().min(1).max(64).optional(),
    reason: z.enum(DISCOUNT_SUGGESTION_REASONS).optional(),
  })
  .strict();

const sendError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid request', details: error.errors });
  if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
  console.error(`[discount-suggestions] ${fallback}:`, error instanceof Error ? error.message : error);
  return res.status(500).json({ error: fallback });
};

/** The vendor always comes from the authenticated user; a vendorId from the client is never used. */
const resolveOwnVendor = async (req: AuthRequest, res: Response) => {
  const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id }, select: { id: true, status: true } });
  if (!vendor) {
    res.status(404).json({ error: 'Vendor not found' });
    return null;
  }
  if (vendor.status !== 'APPROVED') {
    res.status(403).json({ error: 'Vendor account is not approved or is suspended' });
    return null;
  }
  return vendor;
};

// GET /api/vendor/discount-suggestions
export const getVendorSuggestions = async (req: AuthRequest, res: Response) => {
  try {
    const vendor = await resolveOwnVendor(req, res);
    if (!vendor) return;
    const query = listQuerySchema.parse(req.query);
    res.json(await listDiscountSuggestions({ vendorId: vendor.id, status: query.status, reasonType: query.reason, page: query.page, limit: query.limit }, false));
  } catch (error) {
    sendError(res, error, 'Failed to load discount suggestions');
  }
};

// PATCH /api/vendor/discount-suggestions/:id  { action: 'approve' | 'reject' }
export const decideVendorSuggestion = async (req: AuthRequest, res: Response) => {
  try {
    const vendor = await resolveOwnVendor(req, res);
    if (!vendor) return;
    const { action } = decisionSchema.parse(req.body);
    const result = await decideDiscountSuggestion(req.params.id, action, { id: req.user!.id, role: req.user!.role }, vendor.id);
    res.json({ suggestion: { ...result.suggestion, decidedBy: undefined, pricingSnapshot: undefined }, applied: result.applied });
  } catch (error) {
    sendError(res, error, 'Failed to update discount suggestion');
  }
};

// GET /api/admin/discount-suggestions
export const getAdminSuggestions = async (req: AuthRequest, res: Response) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const result = await listDiscountSuggestions(
      { vendorId: query.vendorId, status: query.status, reasonType: query.reason, page: query.page, limit: query.limit },
      true
    );
    res.json({ ...result, scheduler: { intervalHours: getSuggestionIntervalHours() } });
  } catch (error) {
    sendError(res, error, 'Failed to load discount suggestions');
  }
};

// PATCH /api/admin/discount-suggestions/:id  { action: 'approve' | 'reject' }
export const decideAdminSuggestion = async (req: AuthRequest, res: Response) => {
  try {
    const { action } = decisionSchema.parse(req.body);
    const result = await decideDiscountSuggestion(req.params.id, action, { id: req.user!.id, role: req.user!.role }, null);
    res.json({ suggestion: { ...result.suggestion, pricingSnapshot: undefined }, applied: result.applied });
  } catch (error) {
    sendError(res, error, 'Failed to update discount suggestion');
  }
};

// POST /api/admin/discount-suggestions/generate  { vendorId?, reason? }
export const generateAdminSuggestions = async (req: AuthRequest, res: Response) => {
  try {
    const body = generateSchema.parse(req.body ?? {});
    res.json({ summary: await generateDiscountSuggestions(body) });
  } catch (error) {
    if (error instanceof SuggestionGenerationInProgressError) {
      return res.status(409).json({ error: 'Suggestion generation is already running. Try again shortly.' });
    }
    sendError(res, error, 'Failed to generate discount suggestions');
  }
};
