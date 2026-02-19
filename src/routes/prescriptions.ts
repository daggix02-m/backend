import { Router, Response } from 'express';
import { supabase as supabaseClient } from '../lib/supabase';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';

const router = Router();
const supabase = supabaseClient as any;

/**
 * @route   GET /api/prescriptions
 * @desc    Get all prescriptions
 * @access  Private
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  console.log('[DIAGNOSTIC] GET /api/prescriptions called');
  console.log('[DIAGNOSTIC] User:', req.user);
  
  try {
    const { data: prescriptions, error } = await supabase
      .from('prescriptions')
      .select(`
        *,
        customer:customers (id, name, phone),
        items:prescription_items (
          *,
          medicine:medicines (name, sku, unit_type)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[DIAGNOSTIC] Error fetching prescriptions:', error);
      return res.status(500).json({ error: 'Failed to fetch prescriptions' });
    }

    // Filter by pharmacy if user has a pharmacy_id
    const pharmacyId = req.user?.pharmacyId;
    let filteredPrescriptions = prescriptions || [];
    
    if (pharmacyId) {
      filteredPrescriptions = prescriptions.filter((p: any) => 
        p.pharmacy_id === pharmacyId
      );
    }

    console.log('[DIAGNOSTIC] Returning prescriptions:', filteredPrescriptions.length);
    res.json(filteredPrescriptions);
  } catch (error) {
    console.error('[DIAGNOSTIC] Error fetching prescriptions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/prescriptions/:id
 * @desc    Get prescription by ID
 * @access  Private
 */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: prescription, error } = await supabase
      .from('prescriptions')
      .select(`
        *,
        customer:customers (id, name, phone, email),
        items:prescription_items (
          *,
          medicine:medicines (name, sku, unit_type, strength, manufacturer)
        )
      `)
      .eq('id', req.params.id)
      .single();

    if (error) {
      console.error('Error fetching prescription:', error);
      return res.status(500).json({ error: 'Failed to fetch prescription' });
    }

    if (!prescription) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    // Check if user has access to this prescription
    if (req.user?.pharmacyId && prescription.pharmacy_id !== req.user.pharmacyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(prescription);
  } catch (error) {
    console.error('Error fetching prescription:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /api/prescriptions
 * @desc    Create new prescription
 * @access  Private (Admin/Manager/Pharmacist)
 */
router.post('/', authenticate, authorize('admin', 'manager', 'pharmacist'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      customerId,
      items,
      notes,
      status = 'pending',
      totalAmount
    } = req.body;

    if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const pharmacyId = req.user!.pharmacyId;

    // Create prescription
    const { data: prescription, error: prescriptionError } = await supabase
      .from('prescriptions')
      .insert({
        customer_id: customerId,
        pharmacy_id: pharmacyId,
        notes,
        status,
        total_amount: totalAmount,
        created_by: req.user!.userId
      })
      .select()
      .single();

    if (prescriptionError) {
      console.error('Error creating prescription:', prescriptionError);
      return res.status(500).json({ error: 'Failed to create prescription' });
    }

    // Create prescription items
    const itemsToInsert = items.map((item: any) => ({
      prescription_id: prescription.id,
      medicine_id: item.medicineId,
      quantity: item.quantity,
      dosage: item.dosage,
      instructions: item.instructions
    }));

    const { error: itemsError } = await supabase
      .from('prescription_items')
      .insert(itemsToInsert);

    if (itemsError) {
      console.error('Error creating prescription items:', itemsError);
      return res.status(500).json({ error: 'Failed to create prescription items' });
    }

    res.status(201).json(prescription);
  } catch (error) {
    console.error('Error creating prescription:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   PUT /api/prescriptions/:id
 * @desc    Update prescription
 * @access  Private (Admin/Manager/Pharmacist)
 */
router.put('/:id', authenticate, authorize('admin', 'manager', 'pharmacist'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, notes } = req.body;

    // Verify user has access to this prescription
    const { data: existingPrescription } = await supabase
      .from('prescriptions')
      .select('pharmacy_id')
      .eq('id', req.params.id)
      .single();

    if (!existingPrescription) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    if (existingPrescription.pharmacy_id !== req.user!.pharmacyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data: prescription, error } = await supabase
      .from('prescriptions')
      .update({
        status,
        notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating prescription:', error);
      return res.status(500).json({ error: 'Failed to update prescription' });
    }

    res.json(prescription);
  } catch (error) {
    console.error('Error updating prescription:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   DELETE /api/prescriptions/:id
 * @desc    Delete prescription
 * @access  Private (Admin/Manager)
 */
router.delete('/:id', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    // Verify user has access to this prescription
    const { data: existingPrescription } = await supabase
      .from('prescriptions')
      .select('pharmacy_id')
      .eq('id', req.params.id)
      .single();

    if (!existingPrescription) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    if (existingPrescription.pharmacy_id !== req.user!.pharmacyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { error } = await supabase
      .from('prescriptions')
      .delete()
      .eq('id', req.params.id);

    if (error) {
      console.error('Error deleting prescription:', error);
      return res.status(500).json({ error: 'Failed to delete prescription' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting prescription:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
