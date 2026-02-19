import { Router, Response } from 'express';
import { supabase as supabaseClient } from '../../lib/supabase';
import { AuthUtils } from '../../lib/auth';
import { AuthRequest, authenticate, authorize } from '../../middleware/auth';

const router = Router();
const supabase = supabaseClient as any;

router.get('/plans', async (req, res: Response) => {
  try {
    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching plans:', error);
      return res.status(500).json({ error: 'Failed to fetch plans' });
    }

    res.json(plans || []);
  } catch (error) {
    console.error('Fetch plans error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/plans/all', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching all plans:', error);
      return res.status(500).json({ error: 'Failed to fetch plans' });
    }

    res.json(plans || []);
  } catch (error) {
    console.error('Fetch all plans error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/plans', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      name, description, price, currency, billingCycle,
      maxBranches, maxStaffPerBranch, maxMedicines, maxImportRows,
      features, isPopular, displayOrder
    } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    const { data: plan, error } = await supabase
      .from('subscription_plans')
      .insert({
        name,
        description,
        price,
        currency: currency || 'ETB',
        billing_cycle: billingCycle || 'monthly',
        max_branches: maxBranches || 1,
        max_staff_per_branch: maxStaffPerBranch || 5,
        max_medicines: maxMedicines || 100,
        max_import_rows: maxImportRows || 100,
        features: features || {},
        is_active: true,
        is_popular: isPopular || false,
        display_order: displayOrder || 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating plan:', error);
      return res.status(500).json({ error: 'Failed to create plan' });
    }

    res.status(201).json(plan);
  } catch (error) {
    console.error('Create plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/plans/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const planId = parseInt(id);
    const {
      name, description, price, currency, billingCycle,
      maxBranches, maxStaffPerBranch, maxMedicines, maxImportRows,
      features, isPopular, displayOrder, isActive
    } = req.body;

    const { data: plan, error } = await supabase
      .from('subscription_plans')
      .update({
        name,
        description,
        price,
        currency,
        billing_cycle: billingCycle,
        max_branches: maxBranches,
        max_staff_per_branch: maxStaffPerBranch,
        max_medicines: maxMedicines,
        max_import_rows: maxImportRows,
        features,
        is_popular: isPopular,
        display_order: displayOrder,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', planId)
      .select()
      .single();

    if (error) {
      console.error('Error updating plan:', error);
      return res.status(500).json({ error: 'Failed to update plan' });
    }

    res.json(plan);
  } catch (error) {
    console.error('Update plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/plans/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const planId = parseInt(id);

    const { error } = await supabase
      .from('subscription_plans')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', planId);

    if (error) {
      console.error('Error deactivating plan:', error);
      return res.status(500).json({ error: 'Failed to deactivate plan' });
    }

    res.json({ message: 'Plan deactivated successfully' });
  } catch (error) {
    console.error('Deactivate plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/applications', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;

    let query = supabase
      .from('registration_applications')
      .select(`
        id,
        email,
        full_name,
        phone,
        pharmacy_name,
        pharmacy_address,
        pharmacy_phone,
        pharmacy_email,
        license_number,
        tin_number,
        license_document_url,
        fyda_document_url,
        current_step,
        status,
        rejection_reason,
        created_at,
        submitted_at,
        selected_plan_id,
        subscription_plans (id, name, price)
      `)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: applications, error } = await query;

    if (error) {
      console.error('Error fetching applications:', error);
      return res.status(500).json({ error: 'Failed to fetch applications' });
    }

    res.json(applications || []);
  } catch (error) {
    console.error('Fetch applications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/applications/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const applicationId = parseInt(id);

    const { data: application, error } = await supabase
      .from('registration_applications')
      .select(`
        *,
        subscription_plans (id, name, price, max_branches, max_staff_per_branch)
      `)
      .eq('id', applicationId)
      .single();

    if (error || !application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json(application);
  } catch (error) {
    console.error('Fetch application error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/applications/:id/approve', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const applicationId = parseInt(id);
    const adminId = req.user!.userId;

    const { data: application } = await supabase
      .from('registration_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (application.status !== 'submitted') {
      return res.status(400).json({ error: 'Application must be submitted before approval' });
    }

    const { data: pharmacy, error: pharmacyError } = await supabase
      .from('pharmacies')
      .insert({
        name: application.pharmacy_name,
        address: application.pharmacy_address,
        phone: application.pharmacy_phone,
        email: application.pharmacy_email,
        license_number: application.license_number,
        tin_number: application.tin_number,
        verification_status: 'verified',
        subscription_status: 'trial',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (pharmacyError || !pharmacy) {
      console.error('Error creating pharmacy:', pharmacyError);
      return res.status(500).json({ error: 'Failed to create pharmacy' });
    }

    const { data: managerRole } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'manager')
      .single();

    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        email: application.email,
        password_hash: application.password_hash,
        full_name: application.full_name,
        pharmacy_id: pharmacy.id,
        is_active: true,
        is_owner: true,
        must_change_password: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (userError || !user) {
      console.error('Error creating user:', userError);
      await supabase.from('pharmacies').delete().eq('id', pharmacy.id);
      return res.status(500).json({ error: 'Failed to create user' });
    }

    if (managerRole) {
      await supabase.from('user_roles').insert({
        user_id: user.id,
        role_id: managerRole.id,
      });
    }

    await supabase
      .from('pharmacies')
      .update({ owner_id: user.id })
      .eq('id', pharmacy.id);

    const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    await supabase
      .from('pharmacy_subscriptions')
      .insert({
        pharmacy_id: pharmacy.id,
        plan_id: application.selected_plan_id,
        status: 'trial',
        trial_ends_at: trialEndsAt.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .insert({
        pharmacy_id: pharmacy.id,
        name: 'Main Branch',
        location: application.pharmacy_address,
        phone: application.pharmacy_phone,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (branch && user) {
      await supabase.from('user_branches').insert({
        user_id: user.id,
        branch_id: branch.id,
      });
    }

    await supabase
      .from('registration_applications')
      .update({
        status: 'approved',
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId);

    const token = AuthUtils.generateToken({
      userId: user.id,
      pharmacyId: pharmacy.id,
      email: user.email,
      roles: ['manager'],
      isOwner: true,
    });

    res.json({
      message: 'Application approved successfully',
      pharmacy: {
        id: pharmacy.id,
        name: pharmacy.name,
      },
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
      },
      trialEndsAt: trialEndsAt.toISOString(),
      loginToken: token,
    });
  } catch (error) {
    console.error('Approve application error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/applications/:id/reject', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const applicationId = parseInt(id);
    const { reason } = req.body;
    const adminId = req.user!.userId;

    if (!reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const { data: application } = await supabase
      .from('registration_applications')
      .select('id, status')
      .eq('id', applicationId)
      .single();

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    await supabase
      .from('registration_applications')
      .update({
        status: 'rejected',
        rejection_reason: reason,
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId);

    res.json({ message: 'Application rejected' });
  } catch (error) {
    console.error('Reject application error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
