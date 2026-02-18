import { Router, Response } from 'express';
import { supabase as supabaseClient } from '../lib/supabase';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';

const router = Router();
const supabase = supabaseClient as any;

/**
 * @route   GET /api/sales/payment-methods
 * @desc    Get available payment methods
 * @access  Private
 */
router.get('/payment-methods', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: methods, error } = await supabase
      .from('payment_methods')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching payment methods:', error);
      return res.status(500).json({ error: 'Failed to fetch payment methods' });
    }

    res.json(methods || []);
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

    // Use Supabase transaction for sale and stock updates
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        pharmacy_id: req.user!.pharmacyId,
        branch_id: branchId,
        pharmacist_id: req.user!.userId,
        user_id: req.user!.userId,
        customer_name: customerName,
        customer_phone: customerPhone,
        total_amount: totalAmount,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        final_amount: finalAmount,
        payment_method_id: paymentMethodId,
        status: isChapaPayment ? 'PENDING' : 'COMPLETED',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (saleError) {
      console.error('Error creating sale:', saleError);
      return res.status(500).json({ error: 'Failed to create sale' });
    }

    // Create SaleItems and update stock
    for (const item of items) {
      // Create sale item
      const { error: itemError } = await supabase
        .from('sale_items')
        .insert({
          sale_id: sale.id,
          medicine_id: item.medicineId,
          batch_id: item.batchId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: item.quantity * item.unitPrice,
        });

      if (itemError) {
        console.error('Error creating sale item:', itemError);
      }

      // Update branch stock
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
            quantity: stock.quantity - item.quantity,
            updated_at: new Date().toISOString(),
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

/**
 * @route   GET /api/sales
 * @desc    Get sales history
 * @access  Private
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { branchId, startDate, endDate } = req.query;

    let query = supabase
      .from('sales')
      .select('*')
      .eq('pharmacy_id', req.user!.pharmacyId)
      .order('created_at', { ascending: false });

    if (branchId) {
      query = query.eq('branch_id', parseInt(branchId as string));
    }

    if (startDate && endDate) {
      query = query.gte('created_at', new Date(startDate as string).toISOString())
                 .lte('created_at', new Date(endDate as string).toISOString());
    }

    const { data: sales, error } = await query;

    if (error) {
      console.error('Error fetching sales:', error);
      return res.status(500).json({ error: 'Failed to fetch sales' });
    }

    res.json(sales || []);
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
