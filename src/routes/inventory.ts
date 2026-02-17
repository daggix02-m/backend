import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';

const router = Router();

/**
 * @route   GET /api/inventory/categories
 * @desc    Get all medicine categories
 * @access  Private
 */
router.get('/categories', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const categories = await prisma.medicineCategory.findMany();
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/inventory/medicines
 * @desc    Get all medicines in the pharmacy
 * @access  Private
 */
router.get('/medicines', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const medicines = await prisma.medicine.findMany({
      where: { pharmacyId: req.user!.pharmacyId },
      include: {
        category: true,
      },
    });
    res.json(medicines);
  } catch (error) {
    console.error('Error fetching medicines:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /api/inventory/medicines
 * @desc    Add a new medicine
 * @access  Private (Admin/Manager/Pharmacist)
 */
router.post('/medicines', authenticate, authorize('admin', 'manager', 'pharmacist'), async (req: AuthRequest, res: Response) => {
  try {
    const { 
      name, genericName, brandName, categoryId, 
      sku, unitType, strength, manufacturer, 
      description, minStockLevel, requiresPrescription 
    } = req.body;

    if (!name || !categoryId || !unitType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const medicine = await prisma.medicine.create({
      data: {
        name,
        genericName,
        brandName,
        categoryId,
        sku,
        unitType,
        strength,
        manufacturer,
        description,
        minStockLevel: minStockLevel || 10,
        requiresPrescription: requiresPrescription || false,
        pharmacyId: req.user!.pharmacyId,
      },
    });

    res.status(201).json(medicine);
  } catch (error) {
    console.error('Error creating medicine:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/inventory/stocks
 * @desc    Get stock levels for all branches or a specific branch
 * @access  Private
 */
router.get('/stocks', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { branchId } = req.query;
    
    const stocks = await prisma.stock.findMany({
      where: {
        medicine: { pharmacyId: req.user!.pharmacyId },
        ...(branchId && { branchId: parseInt(branchId as string) }),
      },
      include: {
        medicine: true,
        branch: true,
      },
    });
    res.json(stocks);
  } catch (error) {
    console.error('Error fetching stocks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /api/inventory/batches
 * @desc    Receive new stock (Batch)
 * @access  Private (Admin/Manager/Pharmacist)
 */
router.post('/batches', authenticate, authorize('admin', 'manager', 'pharmacist'), async (req: AuthRequest, res: Response) => {
  try {
    const { 
      medicineId, branchId, batchNumber, 
      expiryDate, quantityReceived, costPrice, 
      sellingPrice 
    } = req.body;

    if (!medicineId || !branchId || !batchNumber || !expiryDate || !quantityReceived) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create batch
    const batch = await prisma.batch.create({
      data: {
        medicineId,
        branchId,
        batchNumber,
        expiryDate: new Date(expiryDate),
        quantityReceived,
        quantityRemaining: quantityReceived,
        costPrice,
        sellingPrice,
      },
    });

    // Update or create stock record
    const existingStock = await prisma.stock.findFirst({
      where: { medicineId, branchId }
    });

    if (existingStock) {
      await prisma.stock.update({
        where: { id: existingStock.id },
        data: {
          quantity: existingStock.quantity + quantityReceived,
          lastRestocked: new Date(),
        }
      });
    } else {
      await prisma.stock.create({
        data: {
          medicineId,
          branchId,
          quantity: quantityReceived,
          lastRestocked: new Date(),
        }
      });
    }

    res.status(201).json(batch);
  } catch (error) {
    console.error('Error receiving stock batch:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
