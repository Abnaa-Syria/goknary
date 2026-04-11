import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

/**
 * Public: Get the latest active announcement
 */
export const getActiveAnnouncement = async (_req: Request, res: Response) => {
  try {
    const announcement = await prisma.announcement.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
    
    res.json({ announcement });
  } catch (error: any) {
    console.error('Error fetching active announcement:', error);
    res.status(500).json({ error: 'Failed to fetch announcement' });
  }
};

/**
 * Admin: Upsert a single announcement record
 * Note: We ensure only one primary announcement exists to keep management simple.
 */
export const updateAnnouncement = async (req: Request, res: Response) => {
  const { message, isActive } = req.body;

  console.log(req.body);

  if (typeof message !== 'string') {
    return res.status(400).json({ error: 'Message must be a string' });
  }

  try {
    // Check if any announcement exists
    const existing = await prisma.announcement.findFirst();

    let announcement;
    if (existing) {
      // Update existing
      announcement = await prisma.announcement.update({
        where: { id: existing.id },
        data: { message, isActive: isActive ?? existing.isActive },
      });
    } else {
      // Create first one
      announcement = await prisma.announcement.create({
        data: { message, isActive: isActive ?? true },
      });
    }

    res.json({ 
      message: 'Announcement updated successfully', 
      announcement 
    });
  } catch (error: any) {
    console.error('Error updating announcement:', error);
    res.status(500).json({ error: 'Failed to update announcement' });
  }
};
