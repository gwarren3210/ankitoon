-- Create admin-uploads storage bucket for temporary file uploads
-- This bucket stores files temporarily during the admin chapter upload process
-- Files are uploaded client-side, then processed server-side, then deleted

-- Create the bucket (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'admin-uploads',
  'admin-uploads',
  false,  -- Private bucket
  104857600,  -- 100MB limit (Supabase default)
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/zip']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policy: Allow admins to upload to temp/ folder only
CREATE POLICY "Admins can upload to temp folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'admin-uploads'
  AND (storage.foldername(name))[1] = 'temp'
  AND auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);

-- RLS Policy: Allow admins to download from admin-uploads bucket
CREATE POLICY "Admins can download from admin-uploads"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'admin-uploads'
  AND auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);

-- RLS Policy: Allow system/admins to delete temp files
CREATE POLICY "System can delete temp files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'admin-uploads'
  AND (storage.foldername(name))[1] = 'temp'
  AND auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);

-- Note: Files in the temp/ folder should be cleaned up after processing
-- A background job should periodically remove files older than 24 hours
