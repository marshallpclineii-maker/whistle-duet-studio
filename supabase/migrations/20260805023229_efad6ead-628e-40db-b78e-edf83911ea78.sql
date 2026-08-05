CREATE POLICY "own recordings read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own recordings insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own recordings update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own recordings delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);