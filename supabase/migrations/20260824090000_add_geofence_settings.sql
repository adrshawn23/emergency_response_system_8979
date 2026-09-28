CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.user_profiles WHERE id = auth.uid() $$;

CREATE TABLE IF NOT EXISTS public.geofence_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name TEXT NOT NULL DEFAULT 'Primary service area',
  center_latitude DOUBLE PRECISION NOT NULL CHECK (center_latitude BETWEEN -90 AND 90),
  center_longitude DOUBLE PRECISION NOT NULL CHECK (center_longitude BETWEEN -180 AND 180),
  radius_km DOUBLE PRECISION NOT NULL CHECK (radius_km > 0 AND radius_km <= 1000),
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

INSERT INTO public.geofence_settings (id, name, center_latitude, center_longitude, radius_km)
VALUES (1, 'Primary service area', 25.033, 121.5654, 25)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.geofence_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_read_geofence"
ON public.geofence_settings FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "admins_can_update_geofence"
ON public.geofence_settings FOR UPDATE TO authenticated
USING (
  public.current_user_role() = 'admin'
)
WITH CHECK (
  public.current_user_role() = 'admin'
);

CREATE OR REPLACE FUNCTION public.is_inside_service_area(latitude DOUBLE PRECISION, longitude DOUBLE PRECISION)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT is_enabled OR
    6371 * 2 * asin(sqrt(
      power(sin(radians(center_latitude - latitude) / 2), 2) +
      cos(radians(latitude)) * cos(radians(center_latitude)) *
      power(sin(radians(center_longitude - longitude) / 2), 2)
    )) <= radius_km
  FROM public.geofence_settings
  WHERE id = 1;
$$;

CREATE OR REPLACE FUNCTION public.enforce_report_geofence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.coordinates IS NULL
     OR NOT public.is_inside_service_area(
       (NEW.coordinates->>'lat')::DOUBLE PRECISION,
       (NEW.coordinates->>'lng')::DOUBLE PRECISION
     ) THEN
    RAISE EXCEPTION 'Emergency report location is outside the configured service area';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_emergency_report_geofence
BEFORE INSERT ON public.emergency_reports
FOR EACH ROW EXECUTE FUNCTION public.enforce_report_geofence();
