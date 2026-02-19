import { Router, Response } from 'express';
import { supabase as supabaseClient } from '../../lib/supabase';
import { AuthUtils } from '../../lib/auth';
import { AuthRequest, authenticate, authorize } from '../../middleware/auth';
import { uploadDocument } from '../../middleware/upload';
import { uploadFile } from '../../lib/storage';

const router = Router();
const supabase = supabaseClient as any;

const formatApplication = (app: any) => ({
  id: app.id,
  status: app.status,
  email: app.email,
  name: app.full_name,
  phone: app.phone,
  pharmacyName: app.pharmacy_name,
  pharmacyAddress: app.pharmacy_address,
  pharmacyCity: app.pharmacy_address,
  pharmacyPhone: app.pharmacy_phone,
  licenseNumber: app.license_number,
  fydaNumber: app.tin_number,
  licenseDocumentUrl: app.license_document_url,
  fydaDocumentUrl: app.fyda_document_url,
  planId: app.selected_plan_id,
  planName: app.subscription_plans?.name || null,
  submittedAt: app.submitted_at,
  reviewedAt: app.reviewed_at,
  reviewedBy: app.reviewed_by_user ? {
    id: app.reviewed_by_user.id,
    fullName: app.reviewed_by_user.full_name,
  } : null,
  rejectionReason: app.rejection_reason,
});

router.get('/', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
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
        selected_plan_id,
        current_step,
        status,
        reviewed_by,
        reviewed_at,
        rejection_reason,
        created_at,
        updated_at,
        submitted_at,
        completed_at,
        subscription_plans (id, name, price),
        reviewed_by_user:users!registration_applications_reviewed_by_fkey (id, full_name)
      `)
      .order('created_at', { ascending: false });

    if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status as string)) {
      query = query.eq('status', (status as string).toLowerCase());
    }

    const { data: applications, error } = await query;

    if (error) {
      console.error('Error fetching applications:', error);
      return res.status(500).json({ error: 'Failed to fetch applications' });
    }

    res.json((applications || []).map(formatApplication));
  } catch (error) {
    console.error('Fetch applications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const applicationId = parseInt(id);

    const { data: application, error } = await supabase
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
        selected_plan_id,
        current_step,
        status,
        reviewed_by,
        reviewed_at,
        rejection_reason,
        created_at,
        updated_at,
        submitted_at,
        completed_at,
        subscription_plans (id, name, price, max_branches, max_staff_per_branch),
        reviewed_by_user:users!registration_applications_reviewed_by_fkey (id, full_name)
      `)
      .eq('id', applicationId)
      .single();

    if (error || !application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json(formatApplication(application));
  } catch (error) {
    console.error('Fetch application error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticate, authorize('admin'), uploadDocument.fields([
  { name: 'licenseDocument', maxCount: 1 },
  { name: 'fydaDocument', maxCount: 1 },
]), async (req: AuthRequest, res: Response) => {
  try {
    const {
      email,
      password,
      fullName,
      phone,
      pharmacyName,
      pharmacyAddress,
      pharmacyPhone,
      pharmacyEmail,
      licenseNumber,
      tinNumber,
      planId,
    } = req.body;

    if (!email || !password || !fullName || !pharmacyName || !pharmacyAddress || !planId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('id')
      .eq('id', parseInt(planId))
      .eq('is_active', true)
      .single();

    if (!plan) {
      return res.status(400).json({ error: 'Invalid subscription plan' });
    }

    const passwordHash = await AuthUtils.hashPassword(password);

    const { data: application, error: appError } = await supabase
      .from('registration_applications')
      .insert({
        email,
        password_hash: passwordHash,
        full_name: fullName,
        phone,
        pharmacy_name: pharmacyName,
        pharmacy_address: pharmacyAddress,
        pharmacy_phone: pharmacyPhone,
        pharmacy_email: pharmacyEmail,
        license_number: licenseNumber,
        tin_number: tinNumber,
        selected_plan_id: parseInt(planId),
        current_step: 4,
        status: 'pending',
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (appError || !application) {
      console.error('Error creating application:', appError);
      return res.status(500).json({ error: 'Failed to create application' });
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const folder = `registrations/${application.id}`;

    if (files?.licenseDocument?.[0]) {
      const uploadResult = await uploadFile(files.licenseDocument[0], folder, 'license');
      await supabase
        .from('registration_applications')
        .update({ license_document_url: uploadResult.url })
        .eq('id', application.id);
      application.license_document_url = uploadResult.url;
    }

    if (files?.fydaDocument?.[0]) {
      const uploadResult = await uploadFile(files.fydaDocument[0], folder, 'fyda');
      await supabase
        .from('registration_applications')
        .update({ fyda_document_url: uploadResult.url })
        .eq('id', application.id);
      application.fyda_document_url = uploadResult.url;
    }

    const { data: planData } = await supabase
      .from('subscription_plans')
      .select('id, name')
      .eq('id', application.selected_plan_id)
      .single();

    res.status(201).json(formatApplication({ ...application, subscription_plans: planData }));
  } catch (error) {
    console.error('Create application error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/review', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const applicationId = parseInt(id);
    const { status, rejectionReason, notes } = req.body;
    const adminId = req.user!.userId;

    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Status must be APPROVED or REJECTED' });
    }

    if (status === 'REJECTED' && !rejectionReason) {
      return res.status(400).json({ error: 'Rejection reason is required when rejecting' });
    }

    const { data: application } = await supabase
      .from('registration_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (application.status === 'approved' || application.status === 'rejected') {
      return res.status(400).json({ error: 'Application has already been reviewed' });
    }

    if (status === 'REJECTED') {
      const { error: updateError } = await supabase
        .from('registration_applications')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason,
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', applicationId);

      if (updateError) {
        console.error('Error rejecting application:', updateError);
        return res.status(500).json({ error: 'Failed to reject application' });
      }

      const { data: updatedApp } = await supabase
        .from('registration_applications')
        .select(`
          *,
          subscription_plans (id, name),
          reviewed_by_user:users!registration_applications_reviewed_by_fkey (id, full_name)
        `)
        .eq('id', applicationId)
        .single();

      return res.json(formatApplication(updatedApp));
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
        current_period_start: new Date().toISOString(),
        current_period_end: trialEndsAt.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    const { data: branch } = await supabase
      .from('branches')
      .insert({
        pharmacy_id: pharmacy.id,
        name: 'Main Branch',
        location: application.pharmacy_address,
        phone: application.pharmacy_phone,
        is_main_branch: true,
        is_active: true,
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

    const { data: updatedApp } = await supabase
      .from('registration_applications')
      .select(`
        *,
        subscription_plans (id, name),
        reviewed_by_user:users!registration_applications_reviewed_by_fkey (id, full_name)
      `)
      .eq('id', applicationId)
      .single();

    res.json(formatApplication(updatedApp));
  } catch (error) {
    console.error('Review application error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/by-email/:email', async (req, res: Response) => {
  try {
    const email = decodeURIComponent(req.params.email as string);

    const { data: application, error } = await supabase
      .from('registration_applications')
      .select(`
        id,
        email,
        full_name,
        phone,
        pharmacy_name,
        pharmacy_address,
        pharmacy_phone,
        license_number,
        tin_number,
        license_document_url,
        fyda_document_url,
        selected_plan_id,
        current_step,
        status,
        reviewed_by,
        reviewed_at,
        rejection_reason,
        created_at,
        submitted_at,
        subscription_plans (id, name)
      `)
      .eq('email', email)
      .maybeSingle();

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    let reviewedByUser = null;
    if (application.reviewed_by) {
      const { data: reviewer } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('id', application.reviewed_by)
        .single();
      reviewedByUser = reviewer ? { id: reviewer.id, fullName: reviewer.full_name } : null;
    }

    res.json(formatApplication({ ...application, reviewed_by_user: reviewedByUser }));
  } catch (error) {
    console.error('Fetch by email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
