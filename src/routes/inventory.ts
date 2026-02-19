import { Router, Response } from 'express';
import { supabase as supabaseClient } from '../lib/supabase';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';

const router = Router();
const supabase = supabaseClient as any;

/**
 * @route   GET /api/inventory/categories
 * @desc    Get all medicine categories
 * @access  Private
 */
router.get('/categories', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: categories, error } = await supabase
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
    const { data: medicines, error } = await supabase
      .from('medicines')
      .select(`
        *,
        category:medicine_categories (*),
        branch:branches!medicines_branch_id_fkey (*)
      `)
      .order('name');

    if (error) {
      console.error('Error fetching medicines:', error);
      return res.status(500).json({ error: 'Failed to fetch medicines' });
    }

    const filteredMedicines = (medicines || []).filter((m: any) => 
      m.branch && m.branch.pharmacy_id === req.user!.pharmacyId
    );

    res.json(filteredMedicines);
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
    const { data: branch } = await supabase
      .from('branches')
      .select('id, pharmacy_id')
      .eq('id', branchId)
      .single();

    if (!branch || branch.pharmacy_id !== req.user!.pharmacyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data: medicine, error } = await supabase
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

    const { data: stocks, error } = await supabase
      .from('stocks')
      .select('*');

    if (error) {
      console.error('Error fetching stocks:', error);
      return res.json([]);
    }

    let result = stocks || [];
    
    if (branchId) {
      result = result.filter((s: any) => s.branch_id === parseInt(branchId as string));
    }
    
    result = result.filter((s: any) => s.pharmacy_id === req.user!.pharmacyId);

    res.json(result);
  } catch (error) {
    console.error('Error fetching stocks:', error);
    res.json([]);
  }
});

/**
 * @route   GET /api/inventory/batches
 * @desc    Get all medicine batches
 * @access  Private
 */
router.get('/batches', authenticate, async (req: AuthRequest, res: Response) => {
  console.log('[DIAGNOSTIC] GET /api/inventory/batches called');
  console.log('[DIAGNOSTIC] Query params:', req.query);
  console.log('[DIAGNOSTIC] User:', req.user);
  
  try {
    const { branchId, medicineId } = req.query;
    const pharmacyId = req.user!.pharmacyId;
    
    console.log('[DIAGNOSTIC] Pharmacy ID:', pharmacyId);
    console.log('[DIAGNOSTIC] Branch ID:', branchId);
    console.log('[DIAGNOSTIC] Medicine ID:', medicineId);

    // First, get all branches for this pharmacy
    const { data: pharmacyBranches, error: branchesError } = await supabase
      .from('branches')
      .select('id')
      .eq('pharmacy_id', pharmacyId);

    if (branchesError) {
      console.error('[DIAGNOSTIC] Error fetching branches:', branchesError);
      return res.status(500).json({ error: 'Failed to fetch branches' });
    }

    const branchIds = pharmacyBranches?.map((b: any) => b.id) || [];
    console.log('[DIAGNOSTIC] Pharmacy branch IDs:', branchIds);

    let query = supabase
      .from('medicine_batches')
      .select(`
        *,
        medicine:medicines (name, sku, unit_type),
        stocks (quantity, branch_id, pharmacy_id)
      `);
 
    if (medicineId) {
      query = query.eq('medicine_id', medicineId);
    }
 
    const { data: batches, error } = await query.order('expiry_date', { ascending: true });
 
    if (error) {
      console.error('[DIAGNOSTIC] Error fetching batches:', error);
      return res.status(500).json({ error: 'Failed to fetch batches' });
    }
    
    console.log('[DIAGNOSTIC] Total batches fetched:', batches?.length || 0);
 
    // Filter by pharmacy through stocks
    let filteredBatches = (batches || []).filter((b: any) => {
      // Check if batch has stocks
      if (!b.stocks || b.stocks.length === 0) {
        console.log('[DIAGNOSTIC] Batch has no stocks:', b.id);
        return false;
      }

      const stock = b.stocks[0];
      console.log('[DIAGNOSTIC] Batch stock:', stock);
      
      // Check if stock belongs to pharmacy
      if (stock.pharmacy_id !== pharmacyId) {
        console.log('[DIAGNOSTIC] Batch not in pharmacy:', b.id, stock.pharmacy_id, pharmacyId);
        return false;
      }
      
      // Filter by branch if specified
      if (branchId) {
        const branchIdNum = parseInt(branchId as string);
        if (stock.branch_id !== branchIdNum) {
          console.log('[DIAGNOSTIC] Batch not in branch:', b.id, stock.branch_id, branchIdNum);
          return false;
        }
      }
      
      return true;
    });
 
    console.log('[DIAGNOSTIC] Returning filtered batches:', filteredBatches.length);
    res.json(filteredBatches);
  } catch (error) {
    console.error('[DIAGNOSTIC] Error fetching batches:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/inventory/batches/expiring
 * @desc    Get expiring medicine batches
 * @access  Private
 */
router.get('/batches/expiring', authenticate, async (req: AuthRequest, res: Response) => {
  console.log('[DIAGNOSTIC] GET /api/inventory/batches/expiring called');
  console.log('[DIAGNOSTIC] Query params:', req.query);
  console.log('[DIAGNOSTIC] User:', req.user);
  
  try {
    const days = parseInt(req.query.days as string) || 90;
    const pharmacyId = req.user!.pharmacyId;

    // Calculate expiry date threshold
    const expiryThreshold = new Date();
    expiryThreshold.setDate(expiryThreshold.getDate() + days);

    console.log('[DIAGNOSTIC] Expiry threshold:', expiryThreshold.toISOString());

    const { data: batches, error } = await supabase
      .from('medicine_batches')
      .select(`
        *,
        medicine:medicines (name, sku, unit_type),
        stocks (quantity, branch_id, pharmacy_id)
      `)
      .lt('expiry_date', expiryThreshold.toISOString())
      .gte('expiry_date', new Date().toISOString())
      .order('expiry_date', { ascending: true });

    if (error) {
      console.error('[DIAGNOSTIC] Error fetching expiring batches:', error);
      return res.status(500).json({ error: 'Failed to fetch expiring batches' });
    }

    // Filter by pharmacy through stocks
    const filteredBatches = (batches || []).filter((b: any) => 
      b.stocks?.pharmacy_id === pharmacyId
    );

    console.log('[DIAGNOSTIC] Returning expiring batches:', filteredBatches.length);
    res.json(filteredBatches);
  } catch (error) {
    console.error('[DIAGNOSTIC] Error fetching expiring batches:', error);
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
    const { data: batch, error: batchError } = await supabase
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
    const { data: existingStock } = await supabase
      .from('stocks')
      .select('id, quantity')
      .eq('medicine_id', medicineId)
      .eq('branch_id', branchId)
      .single();

    if (existingStock) {
      const { error: updateError } = await supabase
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
      const { error: createError } = await supabase
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
