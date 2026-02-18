import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';

const router = Router();

/**
 * @route   POST /api/refunds
 * @desc    Create a refund for a sale
 * @access  Private (Admin/Manager/Pharmacist)
 */
router.post('/', authenticate, authorize('admin', 'manager', 'pharmacist'), async (req: AuthRequest, res: Response) => {
  try {
    const { saleId, reason, items } = req.body;

    if (!saleId || !items || items.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true }
    });

    if (!sale || sale.pharmacyId !== req.user!.pharmacyId) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    let refundAmount = 0;
    for (const item of items) {
      refundAmount += item.quantity * item.unitPrice;
    }

    const refund = await prisma.$transaction(async (tx: any) => {
      // 1. Create Refund record
      const newRefund = await tx.refund.create({
        data: {
          saleId,
          pharmacyId: req.user!.pharmacyId,
          branchId: sale.branchId,
          userId: req.user!.userId,
          reason,
          refundAmount,
          status: 'COMPLETED'
        }
      });

      // 2. Create RefundItems and update stock
      for (const item of items) {
        await tx.refundItem.create({
          data: {
            refundId: newRefund.id,
            medicineId: item.medicineId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice
          }
        });

        // Add items back to stock
        await tx.stock.update({
          where: {
            id: (await tx.stock.findFirst({
              where: { medicineId: item.medicineId, branchId: sale.branchId }
            })).id
          },
          data: {
            quantity: { increment: item.quantity }
          }
        });
      }

      return newRefund;
    });

    res.status(201).json(refund);
  } catch (error) {
    console.error('Error creating refund:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /api/inventory/movements
 * @desc    Record a stock movement (adjustment/transfer)
 * @access  Private (Admin/Manager/Pharmacist)
 */
router.post('/movements', authenticate, authorize('admin', 'manager', 'pharmacist'), async (req: AuthRequest, res: Response) => {
  try {
    const { medicineId, branchId, quantity, type, reason, targetBranchId } = req.body;

    if (!medicineId || !branchId || !quantity || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const movement = await prisma.$transaction(async (tx: any) => {
      const newMovement = await tx.stockMovement.create({
        data: {
          medicineId,
          branchId,
          userId: req.user!.userId,
          quantity,
          type, // 'IN', 'OUT', 'TRANSFER', 'ADJUSTMENT'
          reason,
          targetBranchId
        }
      });

      // Update source branch stock
      const sourceStock = await tx.stock.findFirst({ where: { medicineId, branchId } });
      if (sourceStock) {
        await tx.stock.update({
          where: { id: sourceStock.id },
          data: {
            quantity: type === 'IN' ? { increment: quantity } : { decrement: quantity }
          }
        });
      }

      // If transfer, update target branch stock
      if (type === 'TRANSFER' && targetBranchId) {
        const targetStock = await tx.stock.findFirst({ where: { medicineId, branchId: targetBranchId } });
        if (targetStock) {
          await tx.stock.update({
            where: { id: targetStock.id },
            data: { quantity: { increment: quantity } }
          });
        } else {
          await tx.stock.create({
            data: { medicineId, branchId: targetBranchId, quantity }
          });
        }
      }

      return newMovement;
    });

    res.status(201).json(movement);
  } catch (error) {
    console.error('Error recording movement:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
