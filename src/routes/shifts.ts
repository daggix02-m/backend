import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';

const router = Router();

/**
 * @route   POST /api/shifts/start
 * @desc    Start a new cashier shift
 * @access  Private
 */
router.post('/start', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { branchId, openingBalance } = req.body;

    if (!branchId || openingBalance === undefined) {
      return res.status(400).json({ error: 'Branch and opening balance are required' });
    }

    // Check if user already has an active shift
    const activeShift = await prisma.cashierShift.findFirst({
      where: {
        userId: req.user!.userId,
        status: 'OPEN'
      }
    });

    if (activeShift) {
      return res.status(400).json({ error: 'You already have an active shift' });
    }

    const shift = await prisma.cashierShift.create({
      data: {
        userId: req.user!.userId,
        branchId,
        startTime: new Date(),
        openingBalance,
        status: 'OPEN'
      }
    });

    res.status(201).json(shift);
  } catch (error) {
    console.error('Error starting shift:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /api/shifts/end
 * @desc    End the current cashier shift
 * @access  Private
 */
router.post('/end', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { closingBalance, notes } = req.body;

    if (closingBalance === undefined) {
      return res.status(400).json({ error: 'Closing balance is required' });
    }

    const activeShift = await prisma.cashierShift.findFirst({
      where: {
        userId: req.user!.userId,
        status: 'OPEN'
      }
    });

    if (!activeShift) {
      return res.status(404).json({ error: 'No active shift found' });
    }

    // Calculate total sales during this shift
    const sales = await prisma.sale.aggregate({
      where: {
        userId: req.user!.userId,
        branchId: activeShift.branchId,
        createdAt: {
          gte: activeShift.startTime
        },
        status: 'COMPLETED'
      },
      _sum: {
        finalAmount: true
      }
    });

    const totalSales = sales._sum.finalAmount || 0;
    const expectedBalance = Number(activeShift.openingBalance || 0) + Number(totalSales);

    const shift = await prisma.cashierShift.update({
      where: { id: activeShift.id },
      data: {
        endTime: new Date(),
        closingBalance,
        actualSales: totalSales,
        status: 'CLOSED',
        notes
      }
    });

    res.json({
      shift,
      summary: {
        openingBalance: activeShift.openingBalance || 0,
        totalSales,
        expectedBalance,
        closingBalance,
        difference: closingBalance - expectedBalance
      }
    });
  } catch (error) {
    console.error('Error ending shift:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
