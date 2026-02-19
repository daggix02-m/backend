import { Router, Response } from 'express';
import { supabase as supabaseClient } from '../../lib/supabase';
import { AuthUtils } from '../../lib/auth';
import { uploadDocument } from '../../middleware/upload';
import { uploadFile } from '../../lib/storage';

const router = Router();
const supabase = supabaseClient as any;

router.post('/start', async (req, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    const { data: existingApplication } = await supabase
      .from('registration_applications')
      .select('id, status')
      .eq('email', email)
      .maybeSingle();

    if (existingApplication) {
      return res.status(200).json({
        message: 'Application already exists',
        applicationId: existingApplication.id,
        currentStep: existingApplication.status === 'submitted' ? 'submitted' : 1,
        status: existingApplication.status,
      });
    }

    const { data: application, error } = await supabase
      .from('registration_applications')
      .insert({
        email,
        current_step: 1,
        status: 'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating application:', error);
      return res.status(500).json({ error: 'Failed to start registration' });
    }

    res.status(201).json({
      message: 'Registration started',
      applicationId: application.id,
      currentStep: 1,
    });
  } catch (error) {
    console.error('Registration start error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/step1', async (req, res: Response) => {
  try {
    const { applicationId, fullName, phone, password } = req.body;

    if (!applicationId || !fullName || !password) {
      return res.status(400).json({ error: 'Application ID, full name, and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const { data: application } = await supabase
      .from('registration_applications')
      .select('id, status')
      .eq('id', applicationId)
      .single();

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const passwordHash = await AuthUtils.hashPassword(password);

    const { error } = await supabase
      .from('registration_applications')
      .update({
        full_name: fullName,
        phone,
        password_hash: passwordHash,
        current_step: 2,
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId);

    if (error) {
      console.error('Error updating step 1:', error);
      return res.status(500).json({ error: 'Failed to save step 1' });
    }

    res.json({
      message: 'Step 1 completed',
      currentStep: 2,
    });
  } catch (error) {
    console.error('Step 1 error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/step2', async (req, res: Response) => {
  try {
    const {
      applicationId,
      pharmacyName,
      pharmacyAddress,
      pharmacyPhone,
      pharmacyEmail,
      licenseNumber,
      tinNumber,
    } = req.body;

    if (!applicationId || !pharmacyName || !pharmacyAddress) {
      return res.status(400).json({ error: 'Application ID, pharmacy name, and address are required' });
    }

    const { data: application } = await supabase
      .from('registration_applications')
      .select('id, status')
      .eq('id', applicationId)
      .single();

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const { error } = await supabase
      .from('registration_applications')
      .update({
        pharmacy_name: pharmacyName,
        pharmacy_address: pharmacyAddress,
        pharmacy_phone: pharmacyPhone,
        pharmacy_email: pharmacyEmail,
        license_number: licenseNumber,
        tin_number: tinNumber,
        current_step: 3,
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId);

    if (error) {
      console.error('Error updating step 2:', error);
      return res.status(500).json({ error: 'Failed to save step 2' });
    }

    res.json({
      message: 'Step 2 completed',
      currentStep: 3,
    });
  } catch (error) {
    console.error('Step 2 error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/upload', uploadDocument.single('document'), async (req, res: Response) => {
  try {
    const { applicationId, documentType } = req.body;

    if (!applicationId || !documentType || !req.file) {
      return res.status(400).json({ error: 'Application ID, document type, and file are required' });
    }

    if (!['license', 'fyda'].includes(documentType)) {
      return res.status(400).json({ error: 'Invalid document type. Use "license" or "fyda"' });
    }

    const { data: application } = await supabase
      .from('registration_applications')
      .select('id')
      .eq('id', applicationId)
      .single();

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const folder = `registrations/${applicationId}`;
    const uploadResult = await uploadFile(req.file, folder, documentType);

    const updateField = documentType === 'license' ? 'license_document_url' : 'fyda_document_url';
    
    await supabase
      .from('registration_applications')
      .update({
        [updateField]: uploadResult.url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId);

    res.json({
      message: `${documentType} document uploaded successfully`,
      url: uploadResult.url,
    });
  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

router.post('/step3', async (req, res: Response) => {
  try {
    const { applicationId, planId } = req.body;

    if (!applicationId || !planId) {
      return res.status(400).json({ error: 'Application ID and plan ID are required' });
    }

    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('id, name')
      .eq('id', planId)
      .eq('is_active', true)
      .single();

    if (!plan) {
      return res.status(404).json({ error: 'Invalid subscription plan' });
    }

    const { data: application } = await supabase
      .from('registration_applications')
      .select('id')
      .eq('id', applicationId)
      .single();

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const { error } = await supabase
      .from('registration_applications')
      .update({
        selected_plan_id: planId,
        current_step: 4,
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId);

    if (error) {
      console.error('Error updating step 3:', error);
      return res.status(500).json({ error: 'Failed to save step 3' });
    }

    res.json({
      message: 'Plan selected',
      currentStep: 4,
      plan: {
        id: plan.id,
        name: plan.name,
      },
    });
  } catch (error) {
    console.error('Step 3 error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/submit', async (req, res: Response) => {
  try {
    const { applicationId } = req.body;

    if (!applicationId) {
      return res.status(400).json({ error: 'Application ID is required' });
    }

    const { data: application } = await supabase
      .from('registration_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (!application.full_name || !application.password_hash || !application.pharmacy_name || 
        !application.pharmacy_address || !application.selected_plan_id) {
      return res.status(400).json({ error: 'Please complete all required steps before submitting' });
    }

    const { error } = await supabase
      .from('registration_applications')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId);

    if (error) {
      console.error('Error submitting application:', error);
      return res.status(500).json({ error: 'Failed to submit application' });
    }

    res.json({
      message: 'Application submitted successfully',
      status: 'submitted',
    });
  } catch (error) {
    console.error('Submit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/status/email/:email', async (req, res: Response) => {
  try {
    const email = req.params.email as string;

    const { data: application } = await supabase
      .from('registration_applications')
      .select(`
        id,
        email,
        full_name,
        phone,
        pharmacy_name,
        pharmacy_address,
        current_step,
        status,
        selected_plan_id,
        rejection_reason,
        created_at,
        submitted_at,
        subscription_plans (id, name, price)
      `)
      .eq('email', email)
      .maybeSingle();

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json({
      id: application.id,
      email: application.email,
      fullName: application.full_name,
      phone: application.phone,
      pharmacyName: application.pharmacy_name,
      pharmacyAddress: application.pharmacy_address,
      currentStep: application.current_step,
      status: application.status,
      selectedPlan: application.subscription_plans,
      rejectionReason: application.rejection_reason,
      createdAt: application.created_at,
      submittedAt: application.submitted_at,
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/status/:applicationId', async (req, res: Response) => {
  try {
    const applicationId = req.params.applicationId as string;

    const { data: application } = await supabase
      .from('registration_applications')
      .select(`
        id,
        email,
        full_name,
        phone,
        pharmacy_name,
        pharmacy_address,
        current_step,
        status,
        selected_plan_id,
        rejection_reason,
        created_at,
        submitted_at,
        subscription_plans (id, name, price)
      `)
      .eq('id', applicationId)
      .single();

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json({
      id: application.id,
      email: application.email,
      fullName: application.full_name,
      phone: application.phone,
      pharmacyName: application.pharmacy_name,
      pharmacyAddress: application.pharmacy_address,
      currentStep: application.current_step,
      status: application.status,
      selectedPlan: application.subscription_plans,
      rejectionReason: application.rejection_reason,
      createdAt: application.created_at,
      submittedAt: application.submitted_at,
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
