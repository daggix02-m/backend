import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';

const router = Router();

/**
 * @route   GET /api/inventory/categories
 * @desc    Get all medicine categories
 * @access  Private
 */
router.get('/categories', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: categories, error } = await prisma
      .from('medicine_categories')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching categories:', error);
      return res.status(500).json({ error: 'Failed to fetch categories' });
    }

    res.json(categories || []);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/inventory/medicines
 * @desc    Get all medicines in pharmacy
 * @access  Private
 */
router.get('/medicines', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Get medicines from user's pharmacy branches
    const { data: medicines, error } = await prisma
      .from('medicines')
      .select(`
        *,
        category:medicine_categories (*),
        branch:branches (*)
      `)
      .eq('branch->pharmacy_id', req.user!.pharmacyId)
      .order('name');

    if (error) {
      console.error('Error fetching medicines:', error);
      return res.status(500).json({ error: 'Failed to fetch medicines' });
    }

    res.json(medicines || []);
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
      description, minStockLevel, requiresPrescription, branchId,
      unitPrice
    } = req.body;

    if (!name || !categoryId || !unitType || !branchId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify branch belongs to user's pharmacy
    const { data: branch } = await prisma
      .from('branches')
      .select('id, pharmacy_id')
      .eq('id', branchId)
      .single();

    if (!branch || branch.pharmacy_id !== req.user!.pharmacyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data: medicine, error } = await prisma
      .from('medicines')
      .insert({
        name,
        generic_name: genericName,
        brand_name: brandName,
        category_id: categoryId,
        sku,
        unit_type: unitType,
        strength,
        manufacturer,
        description,
        min_stock_level: minStockLevel || 10,
        requires_prescription: requiresPrescription || false,
        unit_price: unitPrice || 0,
        branch_id: branchId,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating medicine:', error);
      return res.status(500).json({ error: 'Failed to create medicine' });
    }

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

    let query = prisma
      .from('stocks')
      .select(`
        *,
        medicine:medicines (
          *,
          branch:branches (*)
        ),
        branch:branches (*)
      `)
      .eq('medicine->branch->pharmacy_id', req.user!.pharmacyId);

    if (branchId) {
      query = query.eq('branch_id', parseInt(branchId as string));
    }

    const { data: stocks, error } = await query;

    if (error) {
      console.error('Error fetching stocks:', error);
      return res.status(500).json({ error: 'Failed to fetch stocks' });
    }

    res.json(stocks || []);
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
    const { data: batch, error: batchError } = await prisma
      .from('medicine_batches')
      .insert({
        medicine_id: medicineId,
        batch_number: batchNumber,
        expiry_date: new Date(expiryDate).toISOString(),
        quantity: quantityReceived,
        cost_price: costPrice,
        selling_price: sellingPrice,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (batchError) {
      console.error('Error creating batch:', batchError);
      return res.status(500).json({ error: 'Failed to create batch' });
    }

    // Update or create stock record
    const { data: existingStock } = await prisma
      .from('stocks')
      .select('id, quantity')
      .eq('medicine_id', medicineId)
      .eq('branch_id', branchId)
      .single();

    if (existingStock) {
      const { error: updateError } = await prisma
        .from('stocks')
        .update({
          quantity: existingStock.quantity + quantityReceived,
          last_restocked: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingStock.id);

      if (updateError) {
        console.error('Error updating stock:', updateError);
        return res.status(500).json({ error: 'Failed to update stock' });
      }
    } else {
      const { error: createError } = await prisma
        .from('stocks')
        .insert({
          medicine_id: medicineId,
          branch_id: branchId,
          quantity: quantityReceived,
          last_restocked: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (createError) {
        console.error('Error creating stock:', createError);
        return res.status(500).json({ error: 'Failed to create stock' });
      }
    }

    res.status(201).json(batch);
  } catch (error) {
    console.error('Error receiving stock batch:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
