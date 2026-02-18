import { Router, Response } from 'express';
import { supabase as supabaseClient } from '../lib/supabase';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';

const router = Router();
const supabase = supabaseClient as any;

router.get('/', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { data: pharmacies, error } = await supabase
      .from('pharmacies')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching pharmacies:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.json(pharmacies || []);
  } catch (error) {
    console.error('Error fetching pharmacies:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/my', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: pharmacy, error } = await supabase
      .from('pharmacies')
      .select(`
        *,
        branches (*)
      `)
      .eq('id', req.user!.pharmacyId)
      .single();

    if (error || !pharmacy) {
      return res.status(404).json({ error: 'Pharmacy not found' });
    }

    res.json(pharmacy);
  } catch (error) {
    console.error('Error fetching pharmacy:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/my', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, licenseNumber, address, phone, email, tin, logoUrl, website } = req.body;

    const { data: pharmacy, error } = await supabase
      .from('pharmacies')
      .update({
        name,
        license_number: licenseNumber,
        address,
        phone,
        email,
        tin_number: tin,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.user!.pharmacyId)
      .select()
      .single();

    if (error) {
      console.error('Error updating pharmacy:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.json(pharmacy);
  } catch (error) {
    console.error('Error updating pharmacy:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/branches', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: branches, error } = await supabase
      .from('branches')
      .select('*')
      .eq('pharmacy_id', req.user!.pharmacyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching branches:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.json(branches || []);
  } catch (error) {
    console.error('Error fetching branches:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/branches', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, location, phone, email, isMainBranch } = req.body;

    if (!name || !location) {
      return res.status(400).json({ error: 'Name and location are required' });
    }

    if (isMainBranch) {
      await supabase
        .from('branches')
        .update({ is_main_branch: false })
        .eq('pharmacy_id', req.user!.pharmacyId);
    }

    const { data: branch, error } = await supabase
      .from('branches')
      .insert({
        name,
        location,
        phone,
        email,
        is_main_branch: isMainBranch || false,
        is_active: true,
        pharmacy_id: req.user!.pharmacyId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating branch:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.status(201).json(branch);
  } catch (error) {
    console.error('Error creating branch:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/branches/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, location, phone, email, isMainBranch, isActive } = req.body;

    const branchId = parseInt(id as string);

    const { data: existingBranch } = await supabase
      .from('branches')
      .select('id, pharmacy_id')
      .eq('id', branchId)
      .single();

    if (!existingBranch || existingBranch.pharmacy_id !== req.user!.pharmacyId) {
      return res.status(404).json({ error: 'Branch not found or unauthorized' });
    }

    if (isMainBranch) {
      await supabase
        .from('branches')
        .update({ is_main_branch: false })
        .eq('pharmacy_id', req.user!.pharmacyId);
    }

    const { data: branch, error } = await supabase
      .from('branches')
      .update({
        name,
        location,
        phone,
        email,
        is_main_branch: isMainBranch,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', branchId)
      .select()
      .single();

    if (error) {
      console.error('Error updating branch:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.json(branch);
  } catch (error) {
    console.error('Error updating branch:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
