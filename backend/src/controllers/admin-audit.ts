import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  action: z.string().max(96).optional(),
  entityType: z.string().max(64).optional(),
});

export const getAdminAuditLog = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, action, entityType } = querySchema.parse(req.query);
    const where = {
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
    };
    const [entries, total] = await Promise.all([
      prisma.adminAuditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.adminAuditLog.count({ where }),
    ]);
    const actorIds = Array.from(new Set(entries.map((entry) => entry.actorId)));
    const actors = await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } });
    const actorMap = new Map(actors.map((actor) => [actor.id, actor]));
    res.json({
      entries: entries.map((entry) => ({ ...entry, actor: actorMap.get(entry.actorId) ?? null })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid audit log query' });
    console.error('Error fetching admin audit log:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
};

