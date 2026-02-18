import { Router, Response } from 'express';
import { supabase as supabaseClient } from '../../lib/supabase';
import { AuthRequest, authenticate, authorize } from '../../middleware/auth';
import { uploadSpreadsheet } from '../../middleware/upload';
import { parseExcelFile, parseCSVBuffer } from '../../lib/import/parser';
import { importMedicines } from '../../lib/import/medicines';
import { importStock } from '../../lib/import/stock';
import { generateMedicineTemplate, generateStockTemplate } from '../../lib/import/templates';
import { getActiveSubscription } from '../../middleware/subscription';

const router = Router();
const supabase = supabaseClient as any;

router.get('/dashboard', authenticate, authorize('pharmacist'), async (req: AuthRequest, res: Response) => {
  try {
    const pharmacyId = req.user!.pharmacyId;
    const userId = req.user!.userId;

    const { data: stocks } = await supabase
      .from('stocks')
      .select('id, quantity, medicine_id, medicines (name, min_stock_level)')
      .eq('pharmacy_id', pharmacyId);

    const lowStockItems = (stocks || [])
      .filter((s: any) => s.quantity <= (s.medicines?.min_stock_level || 10))
      .map((s: any) => ({
        id: s.id,
        medicineName: s.medicines?.name,
        quantity: s.quantity,
        minStockLevel: s.medicines?.min_stock_level || 10
      }));

    const { data: batches } = await supabase
      .from('medicine_batches')
      .select('id, expiry_date, quantity, medicines (name)')
      .lte('expiry_date', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());

    const expiringItems = (batches || [])
      .filter((b: any) => b.medicines)
      .map((b: any) => ({
        id: b.id,
        medicineName: b.medicines.name,
        expiryDate: b.expiry_date,
        quantity: b.quantity
      }));

    const { data: sales } = await supabase
      .from('sales')
      .select('id, final_amount, status, created_at')
      .eq('pharmacy_id', pharmacyId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    const today = new Date().toISOString().split('T')[0];
    const todaySales = (sales || []).filter((s: any) => s.created_at?.startsWith(today));
    const todayRevenue = todaySales.reduce((sum: number, s: any) => sum + (parseFloat(s.final_amount) || 0), 0);

    res.json({
      lowStockCount: lowStockItems.length,
      lowStockItems,
      expiringCount: expiringItems.length,
      expiringItems,
      todaySalesCount: todaySales.length,
      todayRevenue,
      recentSales: sales || []
    });
  } catch (error) {
    console.error('Error fetching pharmacist dashboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/sales', authenticate, authorize('pharmacist'), async (req: AuthRequest, res: Response) => {
  try {
    const { branchId, status } = req.query;
    const pharmacyId = req.user!.pharmacyId;
    const userId = req.user!.userId;

    const { data: sales, error } = await supabase
      .from('sales')
      .select(`
        id,
        branch_id,
        user_id,
        customer_name,
        customer_phone,
        total_amount,
        discount_amount,
        tax_amount,
        final_amount,
        status,
        payment_status,
        created_at,
        branches (id, name),
        sale_items (
          id,
          medicine_id,
          quantity,
          unit_price,
          total_price,
          medicines (name)
        )
      `)
      .eq('pharmacy_id', pharmacyId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching sales:', error);
      return res.status(500).json({ error: 'Failed to fetch sales' });
    }

    let result = sales || [];

    if (branchId) {
      result = result.filter((s: any) => s.branch_id === parseInt(branchId as string));
    }

    if (status) {
      result = result.filter((s: any) => s.status === status);
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/sales', authenticate, authorize('pharmacist'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      branchId, customerName, customerPhone,
      items, discountAmount = 0, taxAmount = 0
    } = req.body;
    const pharmacyId = req.user!.pharmacyId;
    const userId = req.user!.userId;

    if (!branchId || !items || items.length === 0) {
      return res.status(400).json({ error: 'Branch and items are required' });
    }

    const { data: branch } = await supabase
      .from('branches')
      .select('id, pharmacy_id')
      .eq('id', branchId)
      .single();

    if (!branch || branch.pharmacy_id !== pharmacyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let totalAmount = 0;
    for (const item of items) {
      totalAmount += item.quantity * item.unitPrice;
    }
    const finalAmount = totalAmount - discountAmount + taxAmount;

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        pharmacy_id: pharmacyId,
        branch_id: branchId,
        pharmacist_id: userId,
        user_id: userId,
        customer_name: customerName,
        customer_phone: customerPhone,
        total_amount: totalAmount,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        final_amount: finalAmount,
        status: 'PENDING',
        payment_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (saleError || !sale) {
      console.error('Error creating sale:', saleError);
      return res.status(500).json({ error: 'Failed to create sale' });
    }

    for (const item of items) {
      await supabase.from('sale_items').insert({
        sale_id: sale.id,
        medicine_id: item.medicineId,
        batch_id: item.batchId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.quantity * item.unitPrice
      });

      const { data: stock } = await supabase
        .from('stocks')
        .select('id, quantity')
        .eq('medicine_id', item.medicineId)
        .eq('branch_id', branchId)
        .single();

      if (stock) {
        await supabase
          .from('stocks')
          .update({
            quantity: Math.max(0, stock.quantity - item.quantity),
            updated_at: new Date().toISOString()
          })
          .eq('id', stock.id);
      }
    }

    res.status(201).json(sale);
  } catch (error) {
    console.error('Error creating sale:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/handoff-to-cashier', authenticate, authorize('pharmacist'), async (req: AuthRequest, res: Response) => {
  try {
    const { saleId } = req.body;
    const pharmacyId = req.user!.pharmacyId;

    if (!saleId) {
      return res.status(400).json({ error: 'Sale ID is required' });
    }

    const { data: sale } = await supabase
      .from('sales')
      .select('id, pharmacy_id, status')
      .eq('id', saleId)
      .single();

    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    if (sale.pharmacy_id !== pharmacyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { error: updateError } = await supabase
      .from('sales')
      .update({
        status: 'PENDING_PAYMENT',
        updated_at: new Date().toISOString()
      })
      .eq('id', saleId);

    if (updateError) {
      console.error('Error handing off sale:', updateError);
      return res.status(500).json({ error: 'Failed to hand off sale' });
    }

    res.json({ message: 'Sale handed off to cashier', saleId });
  } catch (error) {
    console.error('Error handing off sale:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/inventory', authenticate, authorize('pharmacist'), async (req: AuthRequest, res: Response) => {
  try {
    const { branchId, lowStock } = req.query;
    const pharmacyId = req.user!.pharmacyId;

    let query = supabase
      .from('stocks')
      .select(`
        id,
        quantity,
        last_restocked,
        medicine_id,
        branch_id,
        medicines (
          id,
          name,
          generic_name,
          brand_name,
          sku,
          unit_type,
          min_stock_level,
          unit_price,
          medicine_categories (name)
        ),
        branches (id, name, pharmacy_id)
      `);

    const { data: stocks, error } = await query;

    if (error) {
      console.error('Error fetching inventory:', error);
      return res.status(500).json({ error: 'Failed to fetch inventory' });
    }

    let result = (stocks || []).filter((s: any) => 
      s.branches && s.branches.pharmacy_id === pharmacyId
    );

    if (branchId) {
      result = result.filter((s: any) => s.branch_id === parseInt(branchId as string));
    }

    const formatted = result.map((s: any) => ({
      id: s.id,
      quantity: s.quantity,
      lastRestocked: s.last_restocked,
      medicineId: s.medicine_id,
      branchId: s.branch_id,
      medicine: s.medicines ? {
        id: s.medicines.id,
        name: s.medicines.name,
        genericName: s.medicines.generic_name,
        brandName: s.medicines.brand_name,
        sku: s.medicines.sku,
        unitType: s.medicines.unit_type,
        minStockLevel: s.medicines.min_stock_level,
        unitPrice: s.medicines.unit_price,
        category: s.medicines.medicine_categories?.name
      } : null,
      branch: s.branches ? {
        id: s.branches.id,
        name: s.branches.name
      } : null,
      isLowStock: s.quantity <= (s.medicines?.min_stock_level || 10)
    }));

    if (lowStock === 'true') {
      return res.json(formatted.filter((s: any) => s.isLowStock));
    }

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/inventory/restock-request', authenticate, authorize('pharmacist'), async (req: AuthRequest, res: Response) => {
  try {
    const { medicineId, branchId, quantity, notes } = req.body;
    const pharmacyId = req.user!.pharmacyId;
    const userId = req.user!.userId;

    if (!medicineId || !branchId || !quantity) {
      return res.status(400).json({ error: 'Medicine, branch, and quantity are required' });
    }

    const { data: request, error } = await supabase
      .from('restock_requests')
      .insert({
        medicine_id: medicineId,
        branch_id: branchId,
        pharmacy_id: pharmacyId,
        requested_by: userId,
        quantity,
        notes,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating restock request:', error);
      return res.status(500).json({ error: 'Failed to create restock request' });
    }

    res.status(201).json(request);
  } catch (error) {
    console.error('Error creating restock request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/reports', authenticate, authorize('pharmacist'), async (req: AuthRequest, res: Response) => {
  try {
    const { type, branchId } = req.query;
    const pharmacyId = req.user!.pharmacyId;

    if (type === 'low-stock') {
      const { data: stocks } = await supabase
        .from('stocks')
        .select(`
          id,
          quantity,
          medicine_id,
          branch_id,
          medicines (name, min_stock_level, unit_type),
          branches (id, name, pharmacy_id)
        `);

      const result = (stocks || [])
        .filter((s: any) => 
          s.branches?.pharmacy_id === pharmacyId &&
          s.quantity <= (s.medicines?.min_stock_level || 10)
        )
        .filter((s: any) => !branchId || s.branch_id === parseInt(branchId as string))
        .map((s: any) => ({
          medicineName: s.medicines?.name,
          currentStock: s.quantity,
          minStockLevel: s.medicines?.min_stock_level || 10,
          unitType: s.medicines?.unit_type,
          branchName: s.branches?.name
        }));

      return res.json(result);
    }

    if (type === 'expiry') {
      const { data: batches } = await supabase
        .from('medicine_batches')
        .select(`
          id,
          batch_number,
          expiry_date,
          quantity,
          medicine_id,
          medicines (name, branches (pharmacy_id))
        `)
        .lte('expiry_date', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString());

      const result = (batches || [])
        .filter((b: any) => b.medicines?.branches?.pharmacy_id === pharmacyId)
        .map((b: any) => ({
          batchNumber: b.batch_number,
          expiryDate: b.expiry_date,
          quantity: b.quantity,
          medicineName: b.medicines?.name
        }));

      return res.json(result);
    }

    res.json([]);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/inventory/import/medicines', authenticate, authorize('pharmacist'), uploadSpreadsheet.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { branchId, createCategories = 'true', skipDuplicates = 'true' } = req.query;
    let targetBranchId = branchId ? parseInt(branchId as string) : null;

    if (!targetBranchId) {
      const { data: branches } = await supabase
        .from('branches')
        .select('id')
        .eq('pharmacy_id', req.user!.pharmacyId)
        .limit(1);

      if (!branches || branches.length === 0) {
        return res.status(400).json({ error: 'No branch found for this pharmacy' });
      }
      targetBranchId = branches[0].id;
    }

    const subscription = await getActiveSubscription(req.user!.pharmacyId);
    
    let parsed;
    const isCSV = req.file.originalname.toLowerCase().endsWith('.csv');
    
    if (isCSV) {
      parsed = parseCSVBuffer(req.file.buffer);
    } else {
      parsed = parseExcelFile(req.file.buffer);
    }

    if (parsed.totalRows === 0) {
      return res.status(400).json({ error: 'No data rows found in file' });
    }

    if (subscription && parsed.totalRows > subscription.maxImportRows) {
      return res.status(400).json({ 
        error: `Import limit exceeded. Your plan allows ${subscription.maxImportRows} rows.`,
        maxAllowed: subscription.maxImportRows,
      });
    }

    const result = await importMedicines(parsed.rows, req.user!.pharmacyId, targetBranchId!, {
      createCategories: createCategories === 'true',
      skipDuplicates: skipDuplicates === 'true',
    });

    res.json({
      success: true,
      summary: {
        total: result.total,
        imported: result.imported,
        skipped: result.skipped,
        failed: result.failed,
      },
      imported: result.importedItems.slice(0, 50),
      failed: result.failedItems.slice(0, 50),
      warnings: result.warnings,
    });
  } catch (error) {
    console.error('Medicine import error:', error);
    res.status(500).json({ error: 'Failed to import medicines' });
  }
});

router.post('/inventory/import/stock', authenticate, authorize('pharmacist'), uploadSpreadsheet.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { branchId } = req.query;
    let targetBranchId = branchId ? parseInt(branchId as string) : null;

    if (!targetBranchId) {
      const { data: branches } = await supabase
        .from('branches')
        .select('id')
        .eq('pharmacy_id', req.user!.pharmacyId)
        .limit(1);

      if (!branches || branches.length === 0) {
        return res.status(400).json({ error: 'No branch found for this pharmacy' });
      }
      targetBranchId = branches[0].id;
    }

    const subscription = await getActiveSubscription(req.user!.pharmacyId);
    
    let parsed;
    const isCSV = req.file.originalname.toLowerCase().endsWith('.csv');
    
    if (isCSV) {
      parsed = parseCSVBuffer(req.file.buffer);
    } else {
      parsed = parseExcelFile(req.file.buffer);
    }

    if (parsed.totalRows === 0) {
      return res.status(400).json({ error: 'No data rows found in file' });
    }

    if (subscription && parsed.totalRows > subscription.maxImportRows) {
      return res.status(400).json({ 
        error: `Import limit exceeded. Your plan allows ${subscription.maxImportRows} rows.`,
        maxAllowed: subscription.maxImportRows,
      });
    }

    const result = await importStock(parsed.rows, req.user!.pharmacyId, targetBranchId!);

    res.json({
      success: true,
      summary: {
        total: result.total,
        imported: result.imported,
        skipped: result.skipped,
        failed: result.failed,
      },
      imported: result.importedItems.slice(0, 50),
      failed: result.failedItems.slice(0, 50),
      warnings: result.warnings,
    });
  } catch (error) {
    console.error('Stock import error:', error);
    res.status(500).json({ error: 'Failed to import stock' });
  }
});

router.get('/inventory/template/medicines', authenticate, authorize('pharmacist'), (req, res: Response) => {
  const buffer = generateMedicineTemplate();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=medicines_template.xlsx');
  res.send(buffer);
});

router.get('/inventory/template/stock', authenticate, authorize('pharmacist'), (req, res: Response) => {
  const buffer = generateStockTemplate();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=stock_template.xlsx');
  res.send(buffer);
});

export default router;
