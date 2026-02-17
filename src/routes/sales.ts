import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';

const router = Router();

/**
 * @route   GET /api/sales/payment-methods
 * @desc    Get available payment methods
 * @access  Private
 */
router.get('/payment-methods', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const methods = await prisma.paymentMethod.findMany();
    res.json(methods);
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /api/sales
 * @desc    Create a new sale
 * @access  Private (Admin/Manager/Pharmacist/Cashier)
 */
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { 
      branchId, customerName, customerPhone, 
      items, paymentMethodId, discountAmount = 0, 
      taxAmount = 0, isChapaPayment = false 
    } = req.body;

    if (!branchId || !items || items.length === 0 || !paymentMethodId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Calculate totals
    let totalAmount = 0;
    for (const item of items) {
      totalAmount += item.quantity * item.unitPrice;
    }
    const finalAmount = totalAmount - discountAmount + taxAmount;

    // Use a transaction for the sale and stock updates
    const sale = await prisma.$transaction(async (tx: any) => {
      // 1. Create Sale record
      const newSale = await tx.sale.create({
        data: {
          pharmacyId: req.user!.pharmacyId,
          branchId,
          userId: req.user!.userId,
          customerName,
          customerPhone,
          totalAmount,
          discountAmount,
          taxAmount,
          finalAmount,
          status: isChapaPayment ? 'PENDING' : 'COMPLETED',
          paymentMethodId,
        },
      });

      // 2. Create SaleItems and update stock (FEFO logic simplified here)
      for (const item of items) {
        await tx.saleItem.create({
          data: {
            saleId: newSale.id,
            medicineId: item.medicineId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
          },
        });

        // Update branch stock
        await tx.stock.update({
          where: {
            id: (await tx.stock.findFirst({
              where: { medicineId: item.medicineId, branchId }
            })).id
          },
          data: {
            quantity: { decrement: item.quantity }
          }
        });
      }

      return newSale;
    });

    res.status(201).json(sale);
  } catch (error) {
    console.error('Error creating sale:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/sales
 * @desc    Get sales history
 * @access  Private
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { branchId, startDate, endDate } = req.query;

    const sales = await prisma.sale.findMany({
      where: {
        pharmacyId: req.user!.pharmacyId,
        ...(branchId && { branchId: parseInt(branchId as string) }),
        ...(startDate && endDate && {
          createdAt: {
            gte: new Date(startDate as string),
            lte: new Date(endDate as string),
          },
        }),
      },
      include: {
        saleItems: { include: { medicine: true } },
        paymentMethod: true,
        user: { select: { fullName: true } },
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(sales);
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
