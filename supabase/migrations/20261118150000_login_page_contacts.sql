-- Login page contacts: let UNAUTHENTICATED visitors read ACTIVE hotline
-- entries so the sign-in page can show emergency numbers before login.
-- Active-only keeps draft/disabled entries hidden from the public.
CREATE POLICY contacts_anon_select ON public.department_contacts
    FOR SELECT TO anon
    USING (active = true);

-- Seed the universal Philippine emergency number so the panel is not empty;
-- barangay-specific lines are added by admins via the Contacts section.
INSERT INTO public.department_contacts (label, channel, value, description, sort_order, active)
SELECT 'National Emergency Hotline', 'phone', '911', 'Free nationwide emergency number', 0, true
WHERE NOT EXISTS (
    SELECT 1 FROM public.department_contacts WHERE value = '911'
);
