import { Router, Response } from 'express';
import { supabase as supabaseClient } from '../lib/supabase';
import { chapaService, ChapaWebhookPayload } from '../lib/chapa';
import { AuthRequest, authenticate } from '../middleware/auth';
import { config } from '../config';

const router = Router();
const supabase = supabaseClient as any;

router.post('/chapa/initialize', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { saleId, customerEmail, customerFirstName, customerLastName } = req.body;

    if (!saleId || !customerEmail || !customerFirstName || !customerLastName) {
      return res.status(400).json({ 
        error: 'Missing required fields: saleId, customerEmail, customerFirstName, customerLastName' 
      });
    }

    const { data: sale } = await supabase
      .from('sales')
      .select(`
        id,
        total_amount,
        branch_id,
        branches (
          pharmacy_id
        )
      `)
      .eq('id', saleId)
      .single();

    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    if (sale.branches?.pharmacy_id !== req.user!.pharmacyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (sale.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Sale is already completed' });
    }

    const txRef = chapaService.generateTxRef('PHARMA');

    const callbackUrl = `${req.protocol}://${req.get('host')}/api/payments/chapa/callback`;
    const returnUrl = `${req.protocol}://${req.get('host')}/api/payments/chapa/return`;

    const chapaResponse = await chapaService.initializePayment({
      amount: parseFloat(sale.total_amount),
      currency: 'ETB',
      email: customerEmail,
      first_name: customerFirstName,
      last_name: customerLastName,
      tx_ref: txRef,
      callback_url: callbackUrl,
      return_url: returnUrl,
      customization: {
        title: 'PharmaCare Payment',
        description: `Payment for sale #${saleId}`,
      },
      meta: {
        sale_id: saleId,
        pharmacy_id: sale.branches?.pharmacy_id,
        branch_id: sale.branch_id,
      },
    });

    await supabase.from('payment_transactions').insert({
      payment_id: sale.id,
      provider: 'chapa',
      tx_ref: txRef,
      verified: false,
      raw_response: chapaResponse,
      created_at: new Date().toISOString(),
    });

    res.json({
      checkout_url: chapaResponse.data.checkout_url,
      tx_ref: txRef,
    });
  } catch (error: any) {
    console.error('Error initializing Chapa payment:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to initialize payment' 
    });
  }
});

router.get('/chapa/verify/:txRef', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { txRef } = req.params;

    const verificationResponse = await chapaService.verifyPayment(txRef as string);

    const { data: transaction } = await supabase
      .from('payment_transactions')
      .select(`
        id,
        payment_id,
        payments (
          id,
          sale_id,
          sales (
            id,
            branch_id,
            branches (
              pharmacy_id
            )
          )
        )
      `)
      .eq('tx_ref', txRef as string)
      .single();

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const payment = transaction.payments as any;
    const sale = payment?.sales as any;
    const branch = sale?.branches as any;

    if (branch?.pharmacy_id !== req.user!.pharmacyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await supabase
      .from('payment_transactions')
      .update({
        verified: true,
        raw_response: verificationResponse,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transaction.id);

    if (chapaService.isPaymentSuccessful(verificationResponse)) {
      await supabase
        .from('sales')
        .update({ status: 'COMPLETED', updated_at: new Date().toISOString() })
        .eq('id', sale?.id);

      await supabase
        .from('payments')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', payment?.id);
    }

    res.json(verificationResponse);
  } catch (error: any) {
    console.error('Error verifying Chapa payment:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to verify payment' 
    });
  }
});

router.post('/chapa/webhook', async (req: any, res: Response) => {
  const signature = req.headers['chapa-signature'] as string;
  const payload = req.body as ChapaWebhookPayload;

  console.log('Webhook received:', JSON.stringify(payload));

  try {
    if (!signature || !chapaService.validateWebhookSignature(payload, signature)) {
      console.error('Invalid webhook signature:', signature);
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const eventData = chapaService.processWebhookEvent(payload);

    const { data: transaction } = await supabase
      .from('payment_transactions')
      .select(`
        id,
        verified,
        payment_id,
        payments (
          id,
          sale_id
        )
      `)
      .eq('tx_ref', eventData.txRef)
      .single();

    if (!transaction) {
      console.error('Transaction not found:', eventData.txRef);
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transaction.verified) {
      console.log('Transaction already processed:', eventData.txRef);
      return res.json({ received: true, status: 'already_processed' });
    }

    await supabase
      .from('payment_transactions')
      .update({
        verified: true,
        raw_response: payload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transaction.id);

    const payment = transaction.payments as any;

    if (eventData.event === 'transaction.successful' && eventData.status === 'success') {
      await supabase
        .from('sales')
        .update({ status: 'COMPLETED', updated_at: new Date().toISOString() })
        .eq('id', payment?.sale_id);

      await supabase
        .from('payments')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', payment?.id);
    }

    if (eventData.event === 'transaction.failed' || eventData.status === 'failed') {
      await supabase
        .from('sales')
        .update({ status: 'FAILED', updated_at: new Date().toISOString() })
        .eq('id', payment?.sale_id);

      await supabase
        .from('payments')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', payment?.id);
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error('Error processing Chapa webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

router.get('/chapa/callback', async (req: any, res: Response) => {
  try {
    const { tx_ref } = req.query;

    if (!tx_ref) {
      return res.status(400).json({ error: 'Missing transaction reference' });
    }

    const verificationResponse = await chapaService.verifyPayment(tx_ref as string);

    const { data: transaction } = await supabase
      .from('payment_transactions')
      .select(`
        id,
        payment_id,
        payments (
          id,
          sale_id
        )
      `)
      .eq('tx_ref', tx_ref as string)
      .single();

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    await supabase
      .from('payment_transactions')
      .update({
        verified: true,
        raw_response: verificationResponse,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transaction.id);

    const payment = transaction.payments as any;

    if (chapaService.isPaymentSuccessful(verificationResponse)) {
      await supabase
        .from('sales')
        .update({ status: 'COMPLETED', updated_at: new Date().toISOString() })
        .eq('id', payment?.sale_id);

      await supabase
        .from('payments')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', payment?.id);
    }

    const status = chapaService.isPaymentSuccessful(verificationResponse) ? 'success' : 'failed';
    const frontendUrl = process.env.FRONTEND_URL || config.corsOrigin;
    if (frontendUrl === '*' || !frontendUrl) {
      return res.status(500).json({ error: 'FRONTEND_URL environment variable must be set' });
    }
    res.redirect(`${frontendUrl}/payment/${status}?tx_ref=${tx_ref}`);
  } catch (error: any) {
    console.error('Error processing Chapa callback:', error);
    const frontendUrl = process.env.FRONTEND_URL || config.corsOrigin;
    if (frontendUrl === '*' || !frontendUrl) {
      return res.status(500).json({ error: 'FRONTEND_URL environment variable must be set' });
    }
    res.redirect(`${frontendUrl}/payment/error`);
  }
});

router.get('/chapa/return', async (req: any, res: Response) => {
  try {
    const { tx_ref } = req.query;

    if (!tx_ref) {
      return res.status(400).json({ error: 'Missing transaction reference' });
    }

    const frontendUrl = config.corsOrigin === '*' ? 'http://localhost:3000' : config.corsOrigin;
    res.redirect(`${frontendUrl}/payment/return?tx_ref=${tx_ref}`);
  } catch (error: any) {
    console.error('Error processing Chapa return:', error);
    const frontendUrl = process.env.FRONTEND_URL || config.corsOrigin;
    if (frontendUrl === '*' || !frontendUrl) {
      return res.status(500).json({ error: 'FRONTEND_URL environment variable must be set' });
    }
    res.redirect(`${frontendUrl}/payment/error`);
  }
});

router.get('/transactions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { saleId } = req.query;

    let query = supabase
      .from('payment_transactions')
      .select(`
        id,
        provider,
        tx_ref,
        verified,
        created_at,
        payments (
          id,
          status,
          sale_id,
          payment_methods (
            id,
            name
          ),
          sales (
            id,
            branch_id,
            branches (
              name
            )
          )
        )
      `)
      .order('created_at', { ascending: false });

    const { data: transactions, error } = await query;

    if (error) {
      console.error('Error fetching payment transactions:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }

    let result = transactions || [];

    if (saleId) {
      result = result.filter((t: any) => t.payments?.sale_id === parseInt(saleId as string));
    }

    res.json(result);
  } catch (error: any) {
    console.error('Error fetching payment transactions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
