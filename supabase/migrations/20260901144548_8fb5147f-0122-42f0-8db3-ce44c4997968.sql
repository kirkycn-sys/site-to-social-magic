CREATE POLICY "Users read own logos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'brand-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users upload own logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'brand-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update own logos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'brand-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own logos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'brand-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users read own videos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'brand-videos' AND (storage.foldername(name))[1] = auth.uid()::text);