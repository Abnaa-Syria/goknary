import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const updateSettingsSchema = z.object({
  free_shipping_threshold: z.string().optional(),
  support_phone: z.string().optional(),
  facebook_url: z.string().optional(),
  instagram_url: z.string().optional(),
  linkedin_url: z.string().optional(),
  twitter_url: z.string().optional(),
});

// Helper to map DB key-value rows to structured settings object
const mapSettings = (settingsRows: { key: string; value: string }[]) => {
  const settingsMap = new Map(settingsRows.map(row => [row.key, row.value]));
  
  return {
    freeShippingThreshold: parseFloat(settingsMap.get('free_shipping_threshold') || '500'),
    supportPhone: settingsMap.get('support_phone') || '',
    facebookUrl: settingsMap.get('facebook_url') || '',
    instagramUrl: settingsMap.get('instagram_url') || '',
    linkedinUrl: settingsMap.get('linkedin_url') || '',
    twitterUrl: settingsMap.get('twitter_url') || '',
  };
};

// GET /api/settings/public
export const getPublicSettings = async (req: Request, res: Response) => {
  try {
    const keys = [
      'free_shipping_threshold',
      'support_phone',
      'facebook_url',
      'instagram_url',
      'linkedin_url',
      'twitter_url',
    ];
    
    const settings = await prisma.setting.findMany({
      where: { key: { in: keys } },
    });
    
    res.json(mapSettings(settings));
  } catch (error) {
    console.error('Error fetching public settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

// GET /api/settings (Admin-only)
export const getAdminSettings = async (req: AuthRequest, res: Response) => {
  try {
    const settings = await prisma.setting.findMany();
    res.json(mapSettings(settings));
  } catch (error) {
    console.error('Error fetching admin settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

// PUT /api/settings (Admin-only)
export const updateSettings = async (req: AuthRequest, res: Response) => {
  try {
    const body = updateSettingsSchema.parse(req.body);
    
    const updatePromises = Object.entries(body).map(async ([key, value]) => {
      if (value === undefined) return;
      
      return prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    });
    
    await Promise.all(updatePromises);
    
    const updatedSettings = await prisma.setting.findMany();
    res.json({
      message: 'Settings updated successfully',
      settings: mapSettings(updatedSettings),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors });
    }
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
};
