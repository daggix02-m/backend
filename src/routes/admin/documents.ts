import { Router, Response } from 'express';
import { supabase as supabaseClient } from '../../lib/supabase';
import { AuthRequest, authenticate, authorize } from '../../middleware/auth';

const router = Router();
const supabase = supabaseClient as any;

router.get('/pending', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { data: documents, error } = await supabase
      .from('pharmacy_documents')
      .select(`
        id,
        document_type,
        file_url,
        file_name,
        file_size,
        mime_type,
        verification_status,
        uploaded_at,
        pharmacy_id,
        pharmacies (id, name, owner_id, users!pharmacies_owner_id_fkey (id, full_name, email))
      `)
      .eq('verification_status', 'pending')
      .order('uploaded_at', { ascending: true });

    if (error) {
      console.error('Error fetching pending documents:', error);
      return res.status(500).json({ error: 'Failed to fetch documents' });
    }

    res.json(documents || []);
  } catch (error) {
    console.error('Fetch pending documents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/all', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, pharmacyId } = req.query;

    let query = supabase
      .from('pharmacy_documents')
      .select(`
        id,
        document_type,
        file_url,
        file_name,
        file_size,
        mime_type,
        verification_status,
        verified_at,
        rejection_reason,
        uploaded_at,
        pharmacy_id,
        pharmacies (id, name)
      `)
      .order('uploaded_at', { ascending: false });

    if (status) {
      query = query.eq('verification_status', status);
    }

    if (pharmacyId) {
      query = query.eq('pharmacy_id', parseInt(pharmacyId as string));
    }

    const { data: documents, error } = await query;

    if (error) {
      console.error('Error fetching documents:', error);
      return res.status(500).json({ error: 'Failed to fetch documents' });
    }

    res.json(documents || []);
  } catch (error) {
    console.error('Fetch documents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/verify', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const documentId = parseInt(id);
    const adminId = req.user!.userId;

    const { data: document } = await supabase
      .from('pharmacy_documents')
      .select('id, verification_status')
      .eq('id', documentId)
      .single();

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const { error } = await supabase
      .from('pharmacy_documents')
      .update({
        verification_status: 'verified',
        verified_at: new Date().toISOString(),
        verified_by: adminId,
        rejection_reason: null,
      })
      .eq('id', documentId);

    if (error) {
      console.error('Error verifying document:', error);
      return res.status(500).json({ error: 'Failed to verify document' });
    }

    res.json({ message: 'Document verified successfully' });
  } catch (error) {
    console.error('Verify document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/reject', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const documentId = parseInt(id);
    const { reason } = req.body;
    const adminId = req.user!.userId;

    if (!reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const { data: document } = await supabase
      .from('pharmacy_documents')
      .select('id, verification_status')
      .eq('id', documentId)
      .single();

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const { error } = await supabase
      .from('pharmacy_documents')
      .update({
        verification_status: 'rejected',
        verified_at: new Date().toISOString(),
        verified_by: adminId,
        rejection_reason: reason,
      })
      .eq('id', documentId);

    if (error) {
      console.error('Error rejecting document:', error);
      return res.status(500).json({ error: 'Failed to reject document' });
    }

    res.json({ message: 'Document rejected' });
  } catch (error) {
    console.error('Reject document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
