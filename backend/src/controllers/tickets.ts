import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import { ValidationError, NotFoundError } from '../lib/errors';
import { TicketStatus, TicketPriority } from '@prisma/client';

const createTicketSchema = z.object({
  subject: z.string().min(5).max(255),
  message: z.string().min(10),
  priority: z.nativeEnum(TicketPriority).optional().default(TicketPriority.MEDIUM),
});

const replyTicketSchema = z.object({
  message: z.string().min(1),
});

const updateTicketSchema = z.object({
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
});

// POST /api/tickets
export const createTicket = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { subject, message, priority } = createTicketSchema.parse(req.body);

    const ticket = await prisma.supportTicket.create({
      data: {
        userId: req.user.id,
        subject,
        message,
        priority,
        status: 'OPEN',
      },
    });

    res.status(201).json({
      message: 'Support ticket created successfully',
      ticket,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input data', details: error.errors });
    }
    console.error('Error creating ticket:', error);
    res.status(500).json({ error: 'Failed to create support ticket' });
  }
};

// GET /api/tickets
export const getTickets = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const role = req.user.role;
    let where: any = {};

    // Customers and Vendors can only see their own tickets
    if (role === 'CUSTOMER' || role === 'VENDOR') {
      where.userId = req.user.id;
    }
    // ADMIN and STAFF see all tickets

    const tickets = await prisma.supportTicket.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            email: true,
            role: true,
            avatar: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({ tickets });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
};

// GET /api/tickets/:id
export const getTicketById = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            role: true,
            avatar: true,
          },
        },
        messages: {
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                role: true,
                avatar: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundError('Support ticket not found');
    }

    // Auth check: Must be owner or admin/staff
    const isOwner = ticket.userId === req.user.id;
    const isAdminOrStaff = req.user.role === 'ADMIN' || req.user.role === 'STAFF';

    if (!isOwner && !isAdminOrStaff) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    res.json({ ticket });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching ticket:', error);
    res.status(500).json({ error: 'Failed to fetch support ticket details' });
  }
};

// POST /api/tickets/:id/messages
export const replyTicket = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const { message } = replyTicketSchema.parse(req.body);

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
    });

    if (!ticket) {
      throw new NotFoundError('Support ticket not found');
    }

    // Auth check
    const isOwner = ticket.userId === req.user.id;
    const isAdminOrStaff = req.user.role === 'ADMIN' || req.user.role === 'STAFF';

    if (!isOwner && !isAdminOrStaff) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    // Determine new status when user/staff replies
    let newStatus = ticket.status;
    if (isAdminOrStaff) {
      newStatus = 'IN_PROGRESS';
    } else {
      newStatus = 'OPEN';
    }

    // Write reply and update status in a single transaction
    const newMessage = await prisma.$transaction(async (tx) => {
      const msg = await tx.ticketMessage.create({
        data: {
          ticketId: id,
          senderId: req.user!.id,
          message,
        },
        include: {
          sender: {
            select: {
              name: true,
              role: true,
              avatar: true,
            },
          },
        },
      });

      await tx.supportTicket.update({
        where: { id },
        data: {
          status: newStatus,
          updatedAt: new Date(),
        },
      });

      return msg;
    });

    res.status(201).json({
      message: 'Reply submitted successfully',
      reply: newMessage,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input data', details: error.errors });
    }
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error replying to ticket:', error);
    res.status(500).json({ error: 'Failed to submit reply' });
  }
};

// PATCH /api/tickets/:id/status
export const updateTicketStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const { status, priority } = updateTicketSchema.parse(req.body);

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
    });

    if (!ticket) {
      throw new NotFoundError('Support ticket not found');
    }

    const isOwner = ticket.userId === req.user.id;
    const isAdminOrStaff = req.user.role === 'ADMIN' || req.user.role === 'STAFF';

    const updateData: any = {};

    if (status !== undefined) {
      if (!isAdminOrStaff) {
        // Regular users can only close their own tickets
        if (status !== 'CLOSED') {
          return res.status(403).json({ error: 'Forbidden: Customers/Vendors can only set status to CLOSED' });
        }
        if (!isOwner) {
          return res.status(403).json({ error: 'Forbidden: Access denied' });
        }
      }
      updateData.status = status;
    }

    if (priority !== undefined) {
      if (!isAdminOrStaff) {
        return res.status(403).json({ error: 'Forbidden: Only admin/staff can change ticket priority' });
      }
      updateData.priority = priority;
    }

    const updatedTicket = await prisma.supportTicket.update({
      where: { id },
      data: updateData,
    });

    res.json({
      message: 'Support ticket updated successfully',
      ticket: updatedTicket,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input data', details: error.errors });
    }
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error updating ticket status:', error);
    res.status(500).json({ error: 'Failed to update support ticket' });
  }
};
