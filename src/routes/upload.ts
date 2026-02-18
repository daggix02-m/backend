import { Router, Response } from 'express';
import { supabase as supabaseClient } from '../lib/supabase';
import { AuthRequest, authenticate } from '../middleware/auth';
import { uploadDocument } from '../middleware/upload';
import { uploadFile } from '../lib/storage';

const router = Router();
const supabase = supabaseClient as any;

router.post('/document', authenticate, uploadDocument.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { documentType, pharmacyId } = req.body;
    const targetPharmacyId = pharmacyId || req.user?.pharmacyId;

    if (!targetPharmacyId) {
      return res.status(400).json({ error: 'Pharmacy ID is required' });
    }

    if (!documentType) {
      return res.status(400).json({ error: 'Document type is required' });
    }

    const validTypes = ['license', 'fyda_id', 'tin_certificate', 'other'];
    if (!validTypes.includes(documentType)) {
      return res.status(400).json({ error: `Invalid document type. Valid types: ${validTypes.join(', ')}` });
    }

    const folder = `pharmacies/${targetPharmacyId}`;
    const uploadResult = await uploadFile(req.file, folder, documentType);

    const { data: document, error } = await supabase
      .from('pharmacy_documents')
      .insert({
        pharmacy_id: targetPharmacyId,
        document_type: documentType,
        file_url: uploadResult.url,
        file_name: req.file.originalname,
        file_size: req.file.size,
        mime_type: req.file.mimetype,
        verification_status: 'pending',
        uploaded_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving document record:', error);
      return res.status(500).json({ error: 'Failed to save document record' });
    }

    res.status(201).json({
      message: 'Document uploaded successfully',
      document: {
        id: document.id,
        documentType: document.document_type,
        fileUrl: document.file_url,
        fileName: document.file_name,
        verificationStatus: document.verification_status,
        uploadedAt: document.uploaded_at,
      },
    });
  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

router.get('/documents', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { pharmacyId } = req.query;
    const targetPharmacyId = pharmacyId || req.user?.pharmacyId;

    if (!targetPharmacyId) {
      return res.status(400).json({ error: 'Pharmacy ID is required' });
    }

    const { data: documents, error } = await supabase
      .from('pharmacy_documents')
      .select('*')
      .eq('pharmacy_id', targetPharmacyId)
      .order('uploaded_at', { ascending: false });

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

export default router;
