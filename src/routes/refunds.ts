import { Router, Response } from 'express';
import { supabase as supabaseClient } from '../lib/supabase';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';

const router = Router();
const supabase = supabaseClient as any;

router.post('/', authenticate, authorize('admin', 'manager', 'pharmacist'), async (req: AuthRequest, res: Response) => {
  try {
    const { saleId, reason, items } = req.body;

    if (!saleId || !items || items.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data: sale } = await supabase
      .from('sales')
      .select('id, branch_id, pharmacy_id')
      .eq('id', saleId)
      .single();

    if (!sale || sale.pharmacy_id !== req.user!.pharmacyId) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    let refundAmount = 0;
    for (const item of items) {
      refundAmount += item.quantity * item.unitPrice;
    }

    const { data: refund, error: refundError } = await supabase
      .from('refunds')
      .insert({
        sale_id: saleId,
        pharmacy_id: req.user!.pharmacyId,
        amount: refundAmount,
        reason,
        status: 'COMPLETED',
        processed_by: req.user!.userId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (refundError) {
      console.error('Error creating refund:', refundError);
      return res.status(500).json({ error: 'Failed to create refund' });
    }

    for (const item of items) {
      const { data: stock } = await supabase
        .from('stocks')
        .select('id, quantity')
        .eq('medicine_id', item.medicineId)
        .eq('branch_id', sale.branch_id)
        .single();

      if (stock) {
        await supabase
          .from('stocks')
          .update({
            quantity: stock.quantity + item.quantity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', stock.id);
      }
    }

    res.status(201).json(refund);
  } catch (error) {
    console.error('Error creating refund:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/movements', authenticate, authorize('admin', 'manager', 'pharmacist'), async (req: AuthRequest, res: Response) => {
  try {
    const { medicineId, branchId, quantity, type, reason, targetBranchId } = req.body;

    if (!medicineId || !branchId || !quantity || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data: stock, error: stockError } = await supabase
      .from('stocks')
      .select('id, quantity')
      .eq('medicine_id', medicineId)
      .eq('branch_id', branchId)
      .single();

    if (stockError || !stock) {
      return res.status(404).json({ error: 'Stock not found' });
    }

    let newQuantity = stock.quantity;
    if (type === 'IN') {
      newQuantity += quantity;
    } else if (type === 'OUT' || type === 'ADJUSTMENT') {
      newQuantity -= quantity;
    }

    const { error: updateError } = await supabase
      .from('stocks')
      .update({
        quantity: newQuantity,
        updated_at: new Date().toISOString(),
      })
      .eq('id', stock.id);

    if (updateError) {
      console.error('Error updating stock:', updateError);
      return res.status(500).json({ error: 'Failed to update stock' });
    }

    if (type === 'TRANSFER' && targetBranchId) {
      const { data: targetStock } = await supabase
        .from('stocks')
        .select('id, quantity')
        .eq('medicine_id', medicineId)
        .eq('branch_id', targetBranchId)
        .single();

      if (targetStock) {
        await supabase
          .from('stocks')
          .update({
            quantity: targetStock.quantity + quantity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetStock.id);
      } else {
        const { data: pharmacyStock } = await supabase
          .from('stocks')
          .select('pharmacy_id')
          .eq('medicine_id', medicineId)
          .eq('branch_id', branchId)
          .single();

        await supabase.from('stocks').insert({
          medicine_id: medicineId,
          branch_id: targetBranchId,
          pharmacy_id: pharmacyStock?.pharmacy_id || req.user!.pharmacyId,
          quantity,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }

    res.status(201).json({
      message: 'Stock movement recorded',
      type,
      quantity,
      newQuantity,
    });
  } catch (error) {
    console.error('Error recording movement:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
