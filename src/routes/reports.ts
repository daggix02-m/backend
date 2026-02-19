import { Router, Response } from 'express';
import { supabase as supabaseClient } from '../lib/supabase';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';

const router = Router();
const supabase = supabaseClient as any;

/**
 * @route   GET /api/reports/sales
 * @desc    Get sales report
 * @access  Private
 */
router.get('/sales', authenticate, async (req: AuthRequest, res: Response) => {
  console.log('[DIAGNOSTIC] GET /api/reports/sales called');
  console.log('[DIAGNOSTIC] Query params:', req.query);
  console.log('[DIAGNOSTIC] User:', req.user);
  
  try {
    const { startDate, endDate, branchId } = req.query;
    const pharmacyId = req.user!.pharmacyId;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const { data: sales, error } = await supabase
      .from('sales')
      .select(`
        *,
        items:sale_items (
          *,
          medicine:medicines (name, sku)
        ),
        cashier:users (name),
        branch:branches (name)
      `)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[DIAGNOSTIC] Error fetching sales report:', error);
      return res.status(500).json({ error: 'Failed to fetch sales report' });
    }

    // Filter by pharmacy and optionally by branch
    let filteredSales = sales || [];
    filteredSales = filteredSales.filter((s: any) => {
      if (s.pharmacy_id !== pharmacyId) return false;
      if (branchId && s.branch_id !== parseInt(branchId as string)) return false;
      return true;
    });

    // Calculate summary statistics
    const totalSales = filteredSales.reduce((sum: number, s: any) => sum + (s.total_amount || 0), 0);
    const totalItems = filteredSales.reduce((sum: number, s: any) => sum + (s.total_items || 0), 0);
    const avgSaleValue = filteredSales.length > 0 ? totalSales / filteredSales.length : 0;

    const report = {
      summary: {
        totalSales,
        totalTransactions: filteredSales.length,
        totalItems,
        averageSaleValue: avgSaleValue
      },
      sales: filteredSales
    };

    console.log('[DIAGNOSTIC] Returning sales report with', filteredSales.length, 'transactions');
    res.json(report);
  } catch (error) {
    console.error('[DIAGNOSTIC] Error fetching sales report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/reports/inventory
 * @desc    Get inventory report
 * @access  Private
 */
router.get('/inventory', authenticate, async (req: AuthRequest, res: Response) => {
  console.log('[DIAGNOSTIC] GET /api/reports/inventory called');
  console.log('[DIAGNOSTIC] Query params:', req.query);
  console.log('[DIAGNOSTIC] User:', req.user);
  
  try {
    const { branchId } = req.query;
    const pharmacyId = req.user!.pharmacyId;

    const { data: medicines, error } = await supabase
      .from('medicines')
      .select(`
        *,
        category:medicine_categories (name),
        stocks (quantity, branch_id)
      `)
      .order('name');

    if (error) {
      console.error('[DIAGNOSTIC] Error fetching inventory report:', error);
      return res.status(500).json({ error: 'Failed to fetch inventory report' });
    }

    // Filter by pharmacy and optionally by branch
    let filteredMedicines = medicines || [];
    filteredMedicines = filteredMedicines.filter((m: any) => {
      if (!m.stocks || m.stocks.length === 0) return false;
      
      const stock = m.stocks[0];
      if (stock.pharmacy_id !== pharmacyId) return false;
      if (branchId && stock.branch_id !== parseInt(branchId as string)) return false;
      return true;
    });

    // Calculate summary statistics
    const totalMedicines = filteredMedicines.length;
    const lowStockItems = filteredMedicines.filter((m: any) => 
      m.stocks[0]?.quantity <= m.min_stock_level
    );
    const outOfStockItems = filteredMedicines.filter((m: any) => 
      m.stocks[0]?.quantity === 0
    );

    const report = {
      summary: {
        totalMedicines,
        lowStockItems: lowStockItems.length,
        outOfStockItems: outOfStockItems.length
      },
      medicines: filteredMedicines
    };

    console.log('[DIAGNOSTIC] Returning inventory report with', filteredMedicines.length, 'medicines');
    res.json(report);
  } catch (error) {
    console.error('[DIAGNOSTIC] Error fetching inventory report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/reports/expiring
 * @desc    Get expiring medicines report
 * @access  Private
 */
router.get('/expiring', authenticate, async (req: AuthRequest, res: Response) => {
  console.log('[DIAGNOSTIC] GET /api/reports/expiring called');
  console.log('[DIAGNOSTIC] Query params:', req.query);
  console.log('[DIAGNOSTIC] User:', req.user);
  
  try {
    const days = parseInt(req.query.days as string) || 90;
    const pharmacyId = req.user!.pharmacyId;

    // Calculate expiry date threshold
    const expiryThreshold = new Date();
    expiryThreshold.setDate(expiryThreshold.getDate() + days);

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
      console.error('[DIAGNOSTIC] Error fetching expiring report:', error);
      return res.status(500).json({ error: 'Failed to fetch expiring report' });
    }

    // Filter by pharmacy through stocks
    const filteredBatches = (batches || []).filter((b: any) => 
      b.stocks?.pharmacy_id === pharmacyId
    );

    // Calculate summary statistics
    const totalBatches = filteredBatches.length;
    const totalQuantity = filteredBatches.reduce((sum: number, b: any) => 
      sum + (b.stocks?.quantity || 0), 0
    );

    const report = {
      summary: {
        totalBatches,
        totalQuantity,
        expiryThreshold: expiryThreshold.toISOString()
      },
      batches: filteredBatches
    };

    console.log('[DIAGNOSTIC] Returning expiring report with', filteredBatches.length, 'batches');
    res.json(report);
  } catch (error) {
    console.error('[DIAGNOSTIC] Error fetching expiring report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/reports/revenue
 * @desc    Get revenue report
 * @access  Private
 */
router.get('/revenue', authenticate, async (req: AuthRequest, res: Response) => {
  console.log('[DIAGNOSTIC] GET /api/reports/revenue called');
  console.log('[DIAGNOSTIC] Query params:', req.query);
  console.log('[DIAGNOSTIC] User:', req.user);
  
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;
    const pharmacyId = req.user!.pharmacyId;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const { data: sales, error } = await supabase
      .from('sales')
      .select('created_at, total_amount, payment_method')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[DIAGNOSTIC] Error fetching revenue report:', error);
      return res.status(500).json({ error: 'Failed to fetch revenue report' });
    }

    // Filter by pharmacy
    const filteredSales = sales.filter((s: any) => s.pharmacy_id === pharmacyId);

    // Group by date
    const groupedData: { [key: string]: any } = {};
    
    filteredSales.forEach((sale: any) => {
      const date = new Date(sale.created_at);
      let key: string;
      
      if (groupBy === 'day') {
        key = date.toISOString().split('T')[0];
      } else if (groupBy === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else {
        key = `${date.getFullYear()}`;
      }

      if (!groupedData[key]) {
        groupedData[key] = {
          date: key,
          totalRevenue: 0,
          transactionCount: 0,
          paymentMethods: {}
        };
      }

      groupedData[key].totalRevenue += sale.total_amount || 0;
      groupedData[key].transactionCount += 1;
      
      const method = sale.payment_method || 'unknown';
      if (!groupedData[key].paymentMethods[method]) {
        groupedData[key].paymentMethods[method] = 0;
      }
      groupedData[key].paymentMethods[method] += sale.total_amount || 0;
    });

    const report = {
      summary: {
        totalRevenue: filteredSales.reduce((sum: number, s: any) => sum + (s.total_amount || 0), 0),
        totalTransactions: filteredSales.length
      },
      data: Object.values(groupedData)
    };

    console.log('[DIAGNOSTIC] Returning revenue report with', Object.keys(groupedData).length, 'groups');
    res.json(report);
  } catch (error) {
    console.error('[DIAGNOSTIC] Error fetching revenue report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
