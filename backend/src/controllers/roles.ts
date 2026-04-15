import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { ALL_PERMISSIONS } from '../lib/permissions';

// ─── Validation ──────────────────────────────────────────────────────────────

const createRoleSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(255).optional(),
  permissions: z.array(z.string()).min(1, 'At least one permission is required'),
});

const updateRoleSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  description: z.string().max(255).optional(),
  permissions: z.array(z.string()).optional(),
});

// ─── GET /api/admin/roles ────────────────────────────────────────────────────

export const getAllRoles = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const roles = await prisma.customRole.findMany({
      include: {
        _count: { select: { users: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = roles.map((role) => ({
      ...role,
      permissions: JSON.parse(role.permissions),
      userCount: role._count.users,
    }));

    res.json({ roles: result });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
};

// ─── GET /api/admin/roles/:id ────────────────────────────────────────────────

export const getRoleById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const role = await prisma.customRole.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { users: true } },
        users: {
          select: { id: true, name: true, email: true },
          take: 20,
        },
      },
    });

    if (!role) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }

    res.json({
      ...role,
      permissions: JSON.parse(role.permissions),
      userCount: role._count.users,
    });
  } catch (error) {
    console.error('Get role error:', error);
    res.status(500).json({ error: 'Failed to fetch role' });
  }
};

// ─── POST /api/admin/roles ───────────────────────────────────────────────────

export const createRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, permissions } = createRoleSchema.parse(req.body);

    // Validate all permissions are valid
    const invalid = permissions.filter((p) => !ALL_PERMISSIONS.includes(p));
    if (invalid.length > 0) {
      res.status(400).json({ error: `Invalid permissions: ${invalid.join(', ')}` });
      return;
    }

    const existing = await prisma.customRole.findUnique({ where: { name } });
    if (existing) {
      res.status(409).json({ error: `A role named "${name}" already exists` });
      return;
    }

    const role = await prisma.customRole.create({
      data: {
        name,
        description: description || null,
        permissions: JSON.stringify(permissions),
      },
    });

    res.status(201).json({
      ...role,
      permissions: JSON.parse(role.permissions),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid role data', details: error.errors });
      return;
    }
    console.error('Create role error:', error);
    res.status(500).json({ error: 'Failed to create role' });
  }
};

// ─── PATCH /api/admin/roles/:id ──────────────────────────────────────────────

export const updateRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, permissions } = updateRoleSchema.parse(req.body);

    const existing = await prisma.customRole.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }

    if (permissions) {
      const invalid = permissions.filter((p) => !ALL_PERMISSIONS.includes(p));
      if (invalid.length > 0) {
        res.status(400).json({ error: `Invalid permissions: ${invalid.join(', ')}` });
        return;
      }
    }

    // Check name uniqueness
    if (name && name !== existing.name) {
      const duplicate = await prisma.customRole.findUnique({ where: { name } });
      if (duplicate) {
        res.status(409).json({ error: `A role named "${name}" already exists` });
        return;
      }
    }

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (permissions !== undefined) data.permissions = JSON.stringify(permissions);

    const role = await prisma.customRole.update({
      where: { id: req.params.id },
      data,
    });

    res.json({
      ...role,
      permissions: JSON.parse(role.permissions),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid role data', details: error.errors });
      return;
    }
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
};

// ─── DELETE /api/admin/roles/:id ─────────────────────────────────────────────

export const deleteRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const role = await prisma.customRole.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { users: true } } },
    });

    if (!role) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }

    if (role._count.users > 0) {
      res.status(409).json({
        error: `Cannot delete: ${role._count.users} user(s) are still assigned to this role. Reassign them first.`,
      });
      return;
    }

    await prisma.customRole.delete({ where: { id: req.params.id } });
    res.json({ message: `Role "${role.name}" deleted successfully` });
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({ error: 'Failed to delete role' });
  }
};

// ─── PATCH /api/admin/roles/assign ───────────────────────────────────────────

const assignRoleSchema = z.object({
  userId: z.string().min(1),
  customRoleId: z.string().nullable(),
});

export const assignRoleToUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, customRoleId } = assignRoleSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // If assigning a role, verify it exists and set user role to STAFF
    if (customRoleId) {
      const role = await prisma.customRole.findUnique({ where: { id: customRoleId } });
      if (!role) {
        res.status(404).json({ error: 'Role not found' });
        return;
      }

      await prisma.user.update({
        where: { id: userId },
        data: { customRoleId, role: 'STAFF' },
      });
    } else {
      // Removing role — revert to CUSTOMER
      await prisma.user.update({
        where: { id: userId },
        data: { customRoleId: null, role: 'CUSTOMER' },
      });
    }

    res.json({ message: 'Role assignment updated' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid data', details: error.errors });
      return;
    }
    console.error('Assign role error:', error);
    res.status(500).json({ error: 'Failed to assign role' });
  }
};
