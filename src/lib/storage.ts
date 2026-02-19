import { createClient, SupabaseClient } from '@supabase/supabase-js';

const BUCKET_NAME = 'pharmacy-documents';

const supabaseUrl = process.env.SUPABASE_URL || 'https://qclrrjhynjdnkrbhvmrb.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const getStorageClient = (): SupabaseClient => {
  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required for file uploads');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

export interface UploadResult {
  url: string;
  path: string;
  fileName: string;
}

export const uploadFile = async (
  file: Express.Multer.File,
  folder: string,
  customName?: string
): Promise<UploadResult> => {
  const supabase = getStorageClient();
  const fileExt = file.originalname.split('.').pop();
  const fileName = customName || `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const filePath = `${folder}/${fileName}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });

  if (error) {
    console.error('Storage upload error:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  return {
    url: urlData.publicUrl,
    path: filePath,
    fileName: file.originalname,
  };
};

export const deleteFile = async (filePath: string): Promise<void> => {
  const supabase = getStorageClient();
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([filePath]);

  if (error) {
    console.error('Storage delete error:', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

export const getFileUrl = (filePath: string): string => {
  const supabase = getStorageClient();
  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);
  
  return data.publicUrl;
};

export const getSignedUrl = async (filePath: string, expiresIn: number = 3600): Promise<string> => {
  const supabase = getStorageClient();
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(filePath, expiresIn);

  if (error) {
    console.error('Signed URL error:', error);
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }

  return data.signedUrl;
};

export const listFiles = async (folder: string): Promise<string[]> => {
  const supabase = getStorageClient();
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(folder);

  if (error) {
    console.error('List files error:', error);
    throw new Error(`Failed to list files: ${error.message}`);
  }

  return data.map(file => file.name);
};
