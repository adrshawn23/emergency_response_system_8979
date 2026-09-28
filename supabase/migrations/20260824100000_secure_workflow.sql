-- Public sign-up always starts as a resident. Staff roles require an administrator update.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, phone_number, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'phone_number',
    'resident',
    true
  );
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "users_manage_own_user_profiles" ON public.user_profiles;
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.user_profiles WHERE id = auth.uid() $$;
CREATE POLICY "users_read_own_profile"
ON public.user_profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "users_update_safe_profile_fields"
ON public.user_profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Prevent a profile owner from changing security-sensitive fields.
CREATE OR REPLACE FUNCTION public.protect_profile_security_fields()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() = OLD.id AND public.current_user_role() <> 'admin' THEN
    NEW.role := OLD.role;
    NEW.is_active := OLD.is_active;
    NEW.department_id := OLD.department_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_profile_security_fields_trigger ON public.user_profiles;
CREATE TRIGGER protect_profile_security_fields_trigger
BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_security_fields();

-- Administrators may manage profiles; dispatchers may read responders for assignment.
CREATE POLICY "admins_manage_profiles" ON public.user_profiles FOR ALL TO authenticated
USING (public.current_user_role() = 'admin')
WITH CHECK (public.current_user_role() = 'admin');
CREATE POLICY "staff_read_responder_profiles" ON public.user_profiles FOR SELECT TO authenticated
USING (
  role = 'responder' AND public.current_user_role() IN ('admin','dispatcher','responder')
);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('report-images', 'report-images', true, 10485760, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "authenticated_upload_report_images" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'report-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "public_read_report_images" ON storage.objects FOR SELECT TO public
USING (bucket_id = 'report-images');
