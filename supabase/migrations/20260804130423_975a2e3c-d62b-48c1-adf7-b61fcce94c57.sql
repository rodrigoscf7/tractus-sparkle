CREATE POLICY "auth read perfil fotos" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'perfil-fotos');
CREATE POLICY "auth insert perfil fotos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'perfil-fotos');
CREATE POLICY "auth update perfil fotos" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'perfil-fotos') WITH CHECK (bucket_id = 'perfil-fotos');
CREATE POLICY "auth delete perfil fotos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'perfil-fotos');