import { Router, Response } from 'express';
import { supabase as supabaseClient } from '../lib/supabase';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';

const router = Router();
const supabase = supabaseClient as any;

/**
 * @route   GET /api/customers
 * @desc    Get all customers
 * @access  Private
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  console.log('[DIAGNOSTIC] GET /api/customers called');
  console.log('[DIAGNOSTIC] Query params:', req.query);
  console.log('[DIAGNOSTIC] User:', req.user);
  
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const search = req.query.search as string;

    let query = supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data: customers, error } = await query;

    if (error) {
      console.error('[DIAGNOSTIC] Error fetching customers:', error);
      return res.status(500).json({ error: 'Failed to fetch customers' });
    }

    // Filter by pharmacy if user has a pharmacy_id
    const pharmacyId = req.user?.pharmacyId;
    let filteredCustomers = customers || [];
    
    if (pharmacyId) {
      filteredCustomers = customers.filter((c: any) => 
        c.pharmacy_id === pharmacyId
      );
    }

    console.log('[DIAGNOSTIC] Returning customers:', filteredCustomers.length);
    res.json(filteredCustomers);
  } catch (error) {
    console.error('[DIAGNOSTIC] Error fetching customers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/customers/:id
 * @desc    Get customer by ID
 * @access  Private
 */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: customer, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) {
      console.error('Error fetching customer:', error);
      return res.status(500).json({ error: 'Failed to fetch customer' });
    }

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Check if user has access to this customer
    if (req.user?.pharmacyId && customer.pharmacy_id !== req.user.pharmacyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(customer);
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /api/customers
 * @desc    Create new customer
 * @access  Private (Admin/Manager/Pharmacist/Cashier)
 */
router.post('/', authenticate, authorize('admin', 'manager', 'pharmacist', 'cashier'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      phone,
      email,
      address,
      dateOfBirth,
      insuranceProvider,
      insuranceNumber,
      allergies,
      notes
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    const pharmacyId = req.user!.pharmacyId;

    const { data: customer, error } = await supabase
      .from('customers')
      .insert({
        name,
        phone,
        email,
        address,
        date_of_birth: dateOfBirth,
        insurance_provider: insuranceProvider,
        insurance_number: insuranceNumber,
        allergies,
        notes,
        pharmacy_id: pharmacyId
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating customer:', error);
      return res.status(500).json({ error: 'Failed to create customer' });
    }

    res.status(201).json(customer);
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   PUT /api/customers/:id
 * @desc    Update customer
 * @access  Private (Admin/Manager/Pharmacist/Cashier)
 */
router.put('/:id', authenticate, authorize('admin', 'manager', 'pharmacist', 'cashier'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      phone,
      email,
      address,
      dateOfBirth,
      insuranceProvider,
      insuranceNumber,
      allergies,
      notes
    } = req.body;

    // Verify user has access to this customer
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('pharmacy_id')
      .eq('id', req.params.id)
      .single();

    if (!existingCustomer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    if (existingCustomer.pharmacy_id !== req.user!.pharmacyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data: customer, error } = await supabase
      .from('customers')
      .update({
        name,
        phone,
        email,
        address,
        date_of_birth: dateOfBirth,
        insurance_provider: insuranceProvider,
        insurance_number: insuranceNumber,
        allergies,
        notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating customer:', error);
      return res.status(500).json({ error: 'Failed to update customer' });
    }

    res.json(customer);
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   DELETE /api/customers/:id
 * @desc    Delete customer
 * @access  Private (Admin/Manager)
 */
router.delete('/:id', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    // Verify user has access to this customer
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('pharmacy_id')
      .eq('id', req.params.id)
      .single();

    if (!existingCustomer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    if (existingCustomer.pharmacy_id !== req.user!.pharmacyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', req.params.id);

    if (error) {
      console.error('Error deleting customer:', error);
      return res.status(500).json({ error: 'Failed to delete customer' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
