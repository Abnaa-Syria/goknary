import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getUserNotifications = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    
    // Fetch notifications ordered by newest first, limit to 50
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    
    const unreadCount = await prisma.notification.count({
      where: { userId, read: false }
    });

    res.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Error fetching pulse notifications:', error);
    res.status(500).json({ error: 'Failed to access user notification pulse' });
  }
};

export const markNotificationRead = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    // Verify ownership
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== userId) {
      return res.status(404).json({ error: 'Pulse artifact not found or unlinked' });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true }
    });

    res.json({ message: 'Pulse marked resolved', notification: updated });
  } catch (error) {
    console.error('Error masking pulse:', error);
    res.status(500).json({ error: 'Failed to resolve pulse artifact' });
  }
};

export const markAllNotificationsRead = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const result = await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true }
    });

    res.json({ message: `Resolved ${result.count} pulse artifacts` });
  } catch (error) {
    console.error('Error resolving all pulses:', error);
    res.status(500).json({ error: 'Failed to bulk-resolve pulse data' });
  }
};

export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== userId) {
      return res.status(404).json({ error: 'Pulse artifact not found or unlinked' });
    }

    await prisma.notification.delete({ where: { id } });

    res.json({ message: 'Pulse sequence purged successfully' });
  } catch (error) {
    console.error('Error filtering pulse:', error);
    res.status(500).json({ error: 'Failed to obliterate pulse data' });
  }
};
