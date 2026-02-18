import { Router, Response } from 'express';
import { supabase as supabaseClient } from '../../lib/supabase';
import { prisma } from '../../lib/prisma';
import { AuthRequest, authenticate, authorize } from '../../middleware/auth';

const router = Router();
const supabase = supabaseClient as any;

router.get('/dashboard', authenticate, authorize('cashier'), async (req: AuthRequest, res: Response) => {
  try {
    const pharmacyId = req.user!.pharmacyId;
    const userId = req.user!.userId;

    const { data: pendingPayments } = await supabase
      .from('sales')
      .select('id, final_amount, created_at, customer_name, branches (name)')
      .eq('pharmacy_id', pharmacyId)
      .eq('status', 'PENDING_PAYMENT')
      .order('created_at', { ascending: false });

    const today = new Date().toISOString().split('T')[0];
    
    const { data: todayPayments } = await supabase
      .from('payments')
      .select('id, amount, created_at')
      .eq('pharmacy_id', pharmacyId)
      .gte('created_at', today)
      .eq('status', 'completed');

    const totalTodayPayments = (todayPayments || []).reduce(
      (sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0
    );

    const { data: todayTransactions } = await supabase
      .from('sales')
      .select('id, final_amount, status, created_at')
      .eq('pharmacy_id', pharmacyId)
      .eq('user_id', userId)
      .gte('created_at', today);

    res.json({
      pendingPaymentsCount: pendingPayments?.length || 0,
      pendingPayments: pendingPayments || [],
      todayPaymentsCount: todayPayments?.length || 0,
      totalTodayPayments,
      todayTransactionsCount: todayTransactions?.length || 0
    });
  } catch (error) {
    console.error('Error fetching cashier dashboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/payments', authenticate, authorize('cashier'), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;
    const pharmacyId = req.user!.pharmacyId;

    let query = supabase
      .from('sales')
      .select(`
        id,
        branch_id,
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
      .in('status', ['PENDING', 'PENDING_PAYMENT'])
      .order('created_at', { ascending: false });

    const { data: sales, error } = await query;

    if (error) {
      console.error('Error fetching pending payments:', error);
      return res.status(500).json({ error: 'Failed to fetch pending payments' });
    }

    let result = sales || [];

    if (status) {
      result = result.filter((s: any) => s.status === status);
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching pending payments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/payments/:id/accept', authenticate, authorize('cashier'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const saleId = parseInt(id);
    const { paymentMethodId, amount } = req.body;
    const pharmacyId = req.user!.pharmacyId;
    const userId = req.user!.userId;

    const { data: sale } = await supabase
      .from('sales')
      .select('id, final_amount, status, pharmacy_id')
      .eq('id', saleId)
      .single();

    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    if (sale.pharmacy_id !== pharmacyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (sale.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Sale already completed' });
    }

    const paymentAmount = amount || sale.final_amount;

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        sale_id: saleId,
        pharmacy_id: pharmacyId,
        amount: paymentAmount,
        payment_method_id: paymentMethodId,
        status: 'completed',
        processed_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Error creating payment:', paymentError);
      return res.status(500).json({ error: 'Failed to process payment' });
    }

    await supabase
      .from('sales')
      .update({
        status: 'COMPLETED',
        payment_status: 'completed',
        cashier_id: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', saleId);

    res.json({
      message: 'Payment processed successfully',
      payment,
      receiptNumber: `RCP-${saleId}-${Date.now()}`
    });
  } catch (error) {
    console.error('Error accepting payment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/receipts', authenticate, authorize('cashier'), async (req: AuthRequest, res: Response) => {
  try {
    const { saleId, startDate, endDate } = req.query;
    const pharmacyId = req.user!.pharmacyId;

    let query = supabase
      .from('payments')
      .select(`
        id,
        amount,
        status,
        created_at,
        sale_id,
        payment_methods (id, name),
        sales (
          id,
          customer_name,
          final_amount,
          branches (id, name),
          sale_items (
            id,
            quantity,
            unit_price,
            total_price,
            medicines (name)
          )
        )
      `)
      .eq('pharmacy_id', pharmacyId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    const { data: payments, error } = await query;

    if (error) {
      console.error('Error fetching receipts:', error);
      return res.status(500).json({ error: 'Failed to fetch receipts' });
    }

    let result = (payments || []).map((p: any) => ({
      id: p.id,
      receiptNumber: `RCP-${p.sale_id}-${new Date(p.created_at).getTime()}`,
      amount: p.amount,
      status: p.status,
      createdAt: p.created_at,
      paymentMethod: p.payment_methods?.name,
      sale: p.sales ? {
        id: p.sales.id,
        customerName: p.sales.customer_name,
        finalAmount: p.sales.final_amount,
        branch: p.sales.branches,
        items: p.sales.sale_items
      } : null
    }));

    if (saleId) {
      result = result.filter((r: any) => r.sale?.id === parseInt(saleId as string));
    }

    if (startDate && endDate) {
      const start = new Date(startDate as string).toISOString();
      const end = new Date(endDate as string).toISOString();
      result = result.filter((r: any) => r.createdAt >= start && r.createdAt <= end);
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching receipts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/receipts/:id', authenticate, authorize('cashier'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const paymentId = parseInt(id);
    const pharmacyId = req.user!.pharmacyId;

    const { data: payment, error } = await supabase
      .from('payments')
      .select(`
        id,
        amount,
        status,
        created_at,
        sale_id,
        payment_methods (id, name),
        sales (
          id,
          customer_name,
          customer_phone,
          total_amount,
          discount_amount,
          tax_amount,
          final_amount,
          branches (id, name, location, phone),
          sale_items (
            id,
            quantity,
            unit_price,
            total_price,
            medicines (name, unit_type)
          )
        )
      `)
      .eq('id', paymentId)
      .eq('pharmacy_id', pharmacyId)
      .single();

    if (error || !payment) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    res.json({
      id: payment.id,
      receiptNumber: `RCP-${payment.sale_id}-${new Date(payment.created_at).getTime()}`,
      amount: payment.amount,
      status: payment.status,
      createdAt: payment.created_at,
      paymentMethod: payment.payment_methods?.name,
      sale: payment.sales ? {
        id: payment.sales.id,
        customerName: payment.sales.customer_name,
        customerPhone: payment.sales.customer_phone,
        totalAmount: payment.sales.total_amount,
        discountAmount: payment.sales.discount_amount,
        taxAmount: payment.sales.tax_amount,
        finalAmount: payment.sales.final_amount,
        branch: payment.sales.branches,
        items: payment.sales.sale_items?.map((item: any) => ({
          id: item.id,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          totalPrice: item.total_price,
          medicineName: item.medicines?.name,
          unitType: item.medicines?.unit_type
        }))
      } : null
    });
  } catch (error) {
    console.error('Error fetching receipt:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/returns', authenticate, authorize('cashier'), async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const pharmacyId = req.user!.pharmacyId;

    const { data: refunds, error } = await supabase
      .from('refunds')
      .select(`
        id,
        amount,
        reason,
        status,
        created_at,
        sale_id,
        sales (
          id,
          customer_name,
          branches (name)
        )
      `)
      .eq('pharmacy_id', pharmacyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching returns:', error);
      return res.status(500).json({ error: 'Failed to fetch returns' });
    }

    let result = refunds || [];

    if (startDate && endDate) {
      const start = new Date(startDate as string).toISOString();
      const end = new Date(endDate as string).toISOString();
      result = result.filter((r: any) => r.created_at >= start && r.created_at <= end);
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching returns:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/returns', authenticate, authorize('cashier'), async (req: AuthRequest, res: Response) => {
  try {
    const { saleId, items, reason } = req.body;
    const pharmacyId = req.user!.pharmacyId;
    const userId = req.user!.userId;

    if (!saleId || !items || items.length === 0) {
      return res.status(400).json({ error: 'Sale ID and items are required' });
    }

    const { data: sale } = await supabase
      .from('sales')
      .select('id, pharmacy_id, status, branch_id')
      .eq('id', saleId)
      .single();

    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    if (sale.pharmacy_id !== pharmacyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let refundAmount = 0;
    for (const item of items) {
      refundAmount += item.quantity * item.unitPrice;
    }

    const { data: refund, error: refundError } = await supabase
      .from('refunds')
      .insert({
        sale_id: saleId,
        pharmacy_id: pharmacyId,
        amount: refundAmount,
        reason,
        status: 'completed',
        processed_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (refundError) {
      console.error('Error creating refund:', refundError);
      return res.status(500).json({ error: 'Failed to process return' });
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
            updated_at: new Date().toISOString()
          })
          .eq('id', stock.id);
      }
    }

    res.status(201).json(refund);
  } catch (error) {
    console.error('Error processing return:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/reports', authenticate, authorize('cashier'), async (req: AuthRequest, res: Response) => {
  try {
    const { type, startDate, endDate } = req.query;
    const pharmacyId = req.user!.pharmacyId;

    const start = startDate ? new Date(startDate as string).toISOString() : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const end = endDate ? new Date(endDate as string).toISOString() : new Date().toISOString();

    if (type === 'transactions') {
      const { data: payments } = await supabase
        .from('payments')
        .select('id, amount, status, created_at, payment_methods (name)')
        .eq('pharmacy_id', pharmacyId)
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false });

      return res.json(payments || []);
    }

    if (type === 'returns') {
      const { data: refunds } = await supabase
        .from('refunds')
        .select('id, amount, reason, status, created_at')
        .eq('pharmacy_id', pharmacyId)
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false });

      return res.json(refunds || []);
    }

    res.json([]);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
