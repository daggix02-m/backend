import { Router, Response } from 'express';
import { supabase as supabaseClient } from '../lib/supabase';
import { AuthRequest, authenticate } from '../middleware/auth';

const router = Router();
const supabase = supabaseClient as any;

router.post('/start', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { branchId, openingBalance } = req.body;

    if (!branchId || openingBalance === undefined) {
      return res.status(400).json({ error: 'Branch and opening balance are required' });
    }

    const { data: activeShift } = await supabase
      .from('cashier_shifts')
      .select('id')
      .eq('user_id', req.user!.userId)
      .eq('status', 'OPEN');

    if (activeShift && activeShift.length > 0) {
      return res.status(400).json({ error: 'You already have an active shift' });
    }

    const { data: shift, error } = await supabase
      .from('cashier_shifts')
      .insert({
        user_id: req.user!.userId,
        branch_id: branchId,
        opened_at: new Date().toISOString(),
        opening_balance: openingBalance,
        status: 'OPEN',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error starting shift:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.status(201).json(shift);
  } catch (error) {
    console.error('Error starting shift:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/end', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { closingBalance, notes } = req.body;

    if (closingBalance === undefined) {
      return res.status(400).json({ error: 'Closing balance is required' });
    }

    const { data: activeShift } = await supabase
      .from('cashier_shifts')
      .select('*')
      .eq('user_id', req.user!.userId)
      .eq('status', 'OPEN')
      .single();

    if (!activeShift) {
      return res.status(404).json({ error: 'No active shift found' });
    }

    const { data: sales } = await supabase
      .from('sales')
      .select('final_amount')
      .eq('user_id', req.user!.userId)
      .eq('branch_id', activeShift.branch_id)
      .gte('created_at', activeShift.opened_at)
      .eq('status', 'COMPLETED');

    const totalSales = (sales || []).reduce((sum: number, s: any) => sum + (parseFloat(s.final_amount) || 0), 0);
    const expectedBalance = Number(activeShift.opening_balance || 0) + totalSales;

    const { data: shift, error } = await supabase
      .from('cashier_shifts')
      .update({
        closed_at: new Date().toISOString(),
        closing_balance: closingBalance,
        status: 'CLOSED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', activeShift.id)
      .select()
      .single();

    if (error) {
      console.error('Error ending shift:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.json({
      shift,
      summary: {
        openingBalance: activeShift.opening_balance || 0,
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
