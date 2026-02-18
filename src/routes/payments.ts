import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { chapaService, ChapaWebhookPayload } from '../lib/chapa';
import { AuthRequest, authenticate } from '../middleware/auth';
import { config } from '../config';

const router = Router();

/**
 * @route   POST /api/payments/chapa/initialize
 * @desc    Initialize a Chapa payment for a sale
 * @access  Private
 */
router.post('/chapa/initialize', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { saleId, customerEmail, customerFirstName, customerLastName } = req.body;

    if (!saleId || !customerEmail || !customerFirstName || !customerLastName) {
      return res.status(400).json({ 
        error: 'Missing required fields: saleId, customerEmail, customerFirstName, customerLastName' 
      });
    }

    // Fetch the sale details
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        branch: true,
      },
    });

    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    // Check if sale belongs to the user's pharmacy
    if (sale.branch.pharmacyId !== req.user!.pharmacyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if sale is already paid
    if (sale.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Sale is already completed' });
    }

    // Generate transaction reference
    const txRef = chapaService.generateTxRef('PHARMA');

    // Create callback URL
    const callbackUrl = `${req.protocol}://${req.get('host')}/api/payments/chapa/callback`;
    const returnUrl = `${req.protocol}://${req.get('host')}/api/payments/chapa/return`;

    // Initialize payment with Chapa
    const chapaResponse = await chapaService.initializePayment({
      amount: parseFloat(sale.totalAmount.toString()),
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
        pharmacy_id: sale.branch.pharmacyId,
        branch_id: sale.branchId,
      },
    });

    // Create payment transaction record
    await prisma.paymentTransaction.create({
      data: {
        paymentId: sale.id, // This should be the actual payment ID
        provider: 'chapa',
        txRef: txRef,
        rawResponse: chapaResponse as any,
        verified: false,
      },
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

/**
 * @route   GET /api/payments/chapa/verify/:txRef
 * @desc    Verify a Chapa payment transaction
 * @access  Private
 */
router.get('/chapa/verify/:txRef', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { txRef } = req.params;

    // Verify payment with Chapa
    const verificationResponse = await chapaService.verifyPayment(txRef as string);

    // Update payment transaction record
    const transaction = await prisma.paymentTransaction.findUnique({
      where: { txRef: txRef as string },
      include: {
        payment: {
          include: {
            sale: {
              include: {
                branch: true,
              },
            },
          },
        },
      },
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Check if transaction belongs to user's pharmacy
    if (transaction.payment.sale.branch.pharmacyId !== req.user!.pharmacyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update transaction record
    await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        verified: true,
        rawResponse: verificationResponse as any,
      },
    });

    // If payment is successful, update sale status
    if (chapaService.isPaymentSuccessful(verificationResponse)) {
      await prisma.sale.update({
        where: { id: transaction.payment.sale.id },
        data: { status: 'COMPLETED' },
      });

      await prisma.payment.update({
        where: { id: transaction.payment.id },
        data: { status: 'completed' },
      });
    }

    res.json(verificationResponse);
  } catch (error: any) {
    console.error('Error verifying Chapa payment:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to verify payment' 
    });
  }
});

/**
 * @route   POST /api/payments/chapa/webhook
 * @desc    Handle Chapa webhook events
 * @access  Public (but secured with signature)
 */
router.post('/chapa/webhook', async (req: any, res: Response) => {
  const signature = req.headers['chapa-signature'] as string;
  const payload = req.body as ChapaWebhookPayload;

  // Log webhook payload for debugging
  console.log('Webhook received:', JSON.stringify(payload));

  try {
    // Validate webhook signature
    if (!signature || !chapaService.validateWebhookSignature(payload, signature)) {
      console.error('Invalid webhook signature:', signature);
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Process webhook event
    const eventData = chapaService.processWebhookEvent(payload);

    // Find the transaction
    const transaction = await prisma.paymentTransaction.findUnique({
      where: { txRef: eventData.txRef },
      include: {
        payment: {
          include: {
            sale: {
              include: {
                branch: true,
              },
            },
          },
        },
      },
    });

    if (!transaction) {
      console.error('Transaction not found:', eventData.txRef);
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Check idempotency - prevent duplicate processing
    if (transaction.verified) {
      console.log('Transaction already processed:', eventData.txRef);
      return res.json({ received: true, status: 'already_processed' });
    }

    // Update transaction record
    await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        verified: true,
        rawResponse: payload as any,
      },
    });

    // Handle successful payment
    if (eventData.event === 'transaction.successful' && eventData.status === 'success') {
      await prisma.sale.update({
        where: { id: transaction.payment.sale.id },
        data: { status: 'COMPLETED' },
      });

      await prisma.payment.update({
        where: { id: transaction.payment.id },
        data: { status: 'completed' },
      });
    }

    // Handle failed payment
    if (eventData.event === 'transaction.failed' || eventData.status === 'failed') {
      await prisma.sale.update({
        where: { id: transaction.payment.sale.id },
        data: { status: 'FAILED' },
      });

      await prisma.payment.update({
        where: { id: transaction.payment.id },
        data: { status: 'failed' },
      });
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error('Error processing Chapa webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

/**
 * @route   GET /api/payments/chapa/callback
 * @desc    Handle Chapa callback (redirect after payment)
 * @access  Public
 */
router.get('/chapa/callback', async (req: any, res: Response) => {
  try {
    const { tx_ref } = req.query;

    if (!tx_ref) {
      return res.status(400).json({ error: 'Missing transaction reference' });
    }

    // Verify payment with Chapa
    const verificationResponse = await chapaService.verifyPayment(tx_ref as string);

    // Find the transaction
    const transaction = await prisma.paymentTransaction.findUnique({
      where: { txRef: tx_ref as string },
      include: {
        payment: {
          include: {
            sale: {
              include: {
                branch: true,
              },
            },
          },
        },
      },
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Update transaction record
    await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        verified: true,
        rawResponse: verificationResponse as any,
      },
    });

    // If payment is successful, update sale status
    if (chapaService.isPaymentSuccessful(verificationResponse)) {
      await prisma.sale.update({
        where: { id: transaction.payment.sale.id },
        data: { status: 'COMPLETED' },
      });

      await prisma.payment.update({
        where: { id: transaction.payment.id },
        data: { status: 'completed' },
      });
    }

    // Redirect to frontend with status
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

/**
 * @route   GET /api/payments/chapa/return
 * @desc    Handle Chapa return (user returns from payment page)
 * @access  Public
 */
router.get('/chapa/return', async (req: any, res: Response) => {
  try {
    const { tx_ref } = req.query;

    if (!tx_ref) {
      return res.status(400).json({ error: 'Missing transaction reference' });
    }

    // Redirect to frontend for processing
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

/**
 * @route   GET /api/payments/transactions
 * @desc    Get payment transactions for a sale
 * @access  Private
 */
router.get('/transactions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { saleId } = req.query;

    const where: any = {
      payment: {
        sale: {
          pharmacyId: req.user!.pharmacyId,
        },
      },
    };

    if (saleId) {
      where.paymentId = parseInt(saleId as string);
    }

    const transactions = await prisma.paymentTransaction.findMany({
      where,
      include: {
        payment: {
          include: {
            sale: {
              include: {
                branch: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            paymentMethod: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(transactions);
  } catch (error: any) {
    console.error('Error fetching payment transactions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
