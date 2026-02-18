import { Router, Response } from 'express';
import { supabase as supabaseClient } from '../../lib/supabase';
import { AuthRequest, authenticate, authorize } from '../../middleware/auth';

const router = Router();
const supabase = supabaseClient as any;

router.get('/dashboard', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { data: pharmacies } = await supabase
      .from('pharmacies')
      .select('id, name, is_active, created_at');

    const { data: users } = await supabase
      .from('users')
      .select('id, pharmacy_id, is_active');

    const { data: sales } = await supabase
      .from('sales')
      .select('id, pharmacy_id, total_amount, final_amount, status, created_at');

    const { data: branches } = await supabase
      .from('branches')
      .select('id, pharmacy_id, is_active');

    const totalPharmacies = pharmacies?.length || 0;
    const activePharmacies = pharmacies?.filter((p: any) => p.is_active).length || 0;
    const totalBranches = branches?.length || 0;
    const totalUsers = users?.length || 0;
    const totalRevenue = sales?.reduce((sum: number, s: any) => sum + (parseFloat(s.final_amount) || 0), 0) || 0;

    const recentActivity = sales
      ?.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map((s: any) => ({
        id: s.id,
        type: 'sale',
        amount: s.final_amount,
        status: s.status,
        createdAt: s.created_at
      })) || [];

    res.json({
      totalPharmacies,
      activePharmacies,
      totalBranches,
      totalUsers,
      totalRevenue,
      recentActivity
    });
  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/managers', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;

    let query = supabase
      .from('users')
      .select(`
        id,
        email,
        full_name,
        is_active,
        must_change_password,
        created_at,
        pharmacy_id,
        pharmacies (id, name, is_active),
        user_roles (
          roles (id, name)
        )
      `);

    const { data: users, error } = await query;

    if (error) {
      console.error('Error fetching managers:', error);
      return res.status(500).json({ error: 'Failed to fetch managers' });
    }

    let managers = users
      ?.filter((u: any) => u.user_roles?.some((ur: any) => ur.roles?.name === 'manager'))
      .map((u: any) => ({
        id: u.id,
        email: u.email,
        fullName: u.full_name,
        isActive: u.is_active,
        mustChangePassword: u.must_change_password,
        createdAt: u.created_at,
        pharmacy: u.pharmacies ? {
          id: u.pharmacies.id,
          name: u.pharmacies.name,
          isActive: u.pharmacies.is_active
        } : null,
        roles: u.user_roles?.map((ur: any) => ur.roles?.name) || []
      })) || [];

    if (status === 'pending') {
      managers = managers.filter((m: any) => !m.isActive || !m.pharmacy?.isActive);
    } else if (status === 'active') {
      managers = managers.filter((m: any) => m.isActive && m.pharmacy?.isActive);
    }

    res.json(managers);
  } catch (error) {
    console.error('Error fetching managers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/managers/:id/activate', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = parseInt(id);

    const { data: user } = await supabase
      .from('users')
      .select('id, pharmacy_id')
      .eq('id', userId)
      .single();

    if (!user) {
      return res.status(404).json({ error: 'Manager not found' });
    }

    await supabase
      .from('users')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (user.pharmacy_id) {
      await supabase
        .from('pharmacies')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', user.pharmacy_id);
    }

    res.json({ message: 'Manager activated successfully' });
  } catch (error) {
    console.error('Error activating manager:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/managers/:id/deactivate', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = parseInt(id);

    await supabase
      .from('users')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', userId);

    res.json({ message: 'Manager deactivated successfully' });
  } catch (error) {
    console.error('Error deactivating manager:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/managers/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = parseInt(id);

    const { data: user, error } = await supabase
      .from('users')
      .select(`
        id,
        email,
        full_name,
        is_active,
        must_change_password,
        created_at,
        pharmacy_id,
        pharmacies (id, name, address, phone, email, is_active),
        user_roles (
          roles (id, name)
        )
      `)
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'Manager not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      isActive: user.is_active,
      mustChangePassword: user.must_change_password,
      createdAt: user.created_at,
      pharmacy: user.pharmacies,
      roles: user.user_roles?.map((ur: any) => ur.roles?.name) || []
    });
  } catch (error) {
    console.error('Error fetching manager:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/branches', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { data: branches, error } = await supabase
      .from('branches')
      .select(`
        id,
        name,
        location,
        phone,
        email,
        is_active,
        is_main_branch,
        created_at,
        pharmacy_id,
        pharmacies (id, name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching branches:', error);
      return res.status(500).json({ error: 'Failed to fetch branches' });
    }

    const formattedBranches = branches?.map((b: any) => ({
      id: b.id,
      name: b.name,
      location: b.location,
      phone: b.phone,
      email: b.email,
      isActive: b.is_active,
      isMainBranch: b.is_main_branch,
      createdAt: b.created_at,
      pharmacy: b.pharmacies ? {
        id: b.pharmacies.id,
        name: b.pharmacies.name
      } : null
    })) || [];

    res.json(formattedBranches);
  } catch (error) {
    console.error('Error fetching branches:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/branches', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, location, phone, email, pharmacyId, isMainBranch } = req.body;

    if (!name || !location || !pharmacyId) {
      return res.status(400).json({ error: 'Name, location, and pharmacyId are required' });
    }

    if (isMainBranch) {
      await supabase
        .from('branches')
        .update({ is_main_branch: false })
        .eq('pharmacy_id', pharmacyId);
    }

    const { data: branch, error } = await supabase
      .from('branches')
      .insert({
        name,
        location,
        phone,
        email,
        pharmacy_id: pharmacyId,
        is_main_branch: isMainBranch || false,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating branch:', error);
      return res.status(500).json({ error: 'Failed to create branch' });
    }

    res.status(201).json(branch);
  } catch (error) {
    console.error('Error creating branch:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/branches/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, location, phone, email, isActive, isMainBranch } = req.body;
    const branchId = parseInt(id);

    const { data: existingBranch } = await supabase
      .from('branches')
      .select('id, pharmacy_id')
      .eq('id', branchId)
      .single();

    if (!existingBranch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    if (isMainBranch && existingBranch.pharmacy_id) {
      await supabase
        .from('branches')
        .update({ is_main_branch: false })
        .eq('pharmacy_id', existingBranch.pharmacy_id);
    }

    const { data: branch, error } = await supabase
      .from('branches')
      .update({
        name,
        location,
        phone,
        email,
        is_active: isActive,
        is_main_branch: isMainBranch,
        updated_at: new Date().toISOString()
      })
      .eq('id', branchId)
      .select()
      .single();

    if (error) {
      console.error('Error updating branch:', error);
      return res.status(500).json({ error: 'Failed to update branch' });
    }

    res.json(branch);
  } catch (error) {
    console.error('Error updating branch:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/branches/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const branchId = parseInt(id);

    const { error } = await supabase
      .from('branches')
      .delete()
      .eq('id', branchId);

    if (error) {
      console.error('Error deleting branch:', error);
      return res.status(500).json({ error: 'Failed to delete branch' });
    }

    res.json({ message: 'Branch deleted successfully' });
  } catch (error) {
    console.error('Error deleting branch:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
