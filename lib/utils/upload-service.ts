import * as rawAuth from '@/lib/core/supabase/raw-auth';

export interface UploadResult {
  url: string;
  path: string;
  type: string;
  name: string;
  size: number;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const uploadService = {
  /**
   * Upload a file to Supabase Storage
   */
  async uploadFile(
    file: File, 
    bucket: string = 'thread-attachments', 
    folder: string = 'uploads'
  ): Promise<UploadResult> {
    try {
      const session = rawAuth.getSession();
      const token = session?.access_token;

      if (!token) throw new Error('Not authenticated for upload');

      // Create a unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${folder}/${fileName}`;

      // Upload file
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${filePath}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': SUPABASE_ANON_KEY,
          // 'Content-Type': file.type, // Usually fetch sets this automatically with boundary for FormData, but for binary body?
          // Supabase Storage accepts binary body directly.
          // If we send File, browser sets Content-Type to file type or leaves it.
          // Supabase expects Content-Type header usually.
          'cache-control': '3600',
          'x-upsert': 'false'
        },
        body: file
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Storage upload failed: ${res.status} - ${errorText}`);
      }

      // Get public URL
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${filePath}`;

      return {
        url: publicUrl,
        path: filePath,
        type: file.type,
        name: file.name,
        size: file.size
      };
    } catch (error: any) {
      console.error('Upload Error Details:', {
        message: error?.message,
        error: error,
        bucket,
        filePath: `${folder}/${file.name}`
      });
      throw error;
    }
  },

  /**
   * Upload multiple files
   */
  async uploadFiles(
    files: File[], 
    bucket: string = 'thread-attachments',
    folder: string = 'uploads'
  ): Promise<UploadResult[]> {
    const uploadPromises = files.map(file => this.uploadFile(file, bucket, folder));
    return Promise.all(uploadPromises);
  },

  /**
   * Delete all files in a folder
   */
  async deleteFolder(
    bucket: string,
    folder: string
  ): Promise<boolean> {
    try {

      
      const session = rawAuth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated for deletion');

      // 1. List all files in the folder
      const listRes = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prefix: folder,
          limit: 100
        })
      });

      if (!listRes.ok) throw new Error('Failed to list files');
      const files = await listRes.json();

      if (!files || files.length === 0) {

        return true;
      }

      // 2. Delete all files
      const filesToDelete = files.map((file: any) => `${folder}/${file.name}`);
      
      const deleteRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        // Supabase API expects { "prefixes": ["path1", "path2"] }
        body: JSON.stringify({
          prefixes: filesToDelete
        })
      });

      if (!deleteRes.ok) {
        const errText = await deleteRes.text();
        throw new Error(`Failed to delete files: ${errText}`);
      }


      return true;
    } catch (error) {
      console.error('Delete Folder Error:', error);
      return false;
    }
  }
};
