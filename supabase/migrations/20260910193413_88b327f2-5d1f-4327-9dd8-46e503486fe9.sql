
CREATE POLICY "Users can upload their own videos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'brand-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their own videos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'brand-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own videos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'brand-videos' AND (storage.foldername(name))[1] = auth.uid()::text);
