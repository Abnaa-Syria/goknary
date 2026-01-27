import { Router } from 'express';
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

// Public endpoint - anyone can access brands list
router.get('/', async (req: Request, res: Response) => {
  try {
    const brands = await prisma.brand.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    res.json({ brands });
  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).json({ error: 'Failed to fetch brands' });
  }
});

export default router;

