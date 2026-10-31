-- Keep a staff email in the clinic profile so administrators can identify
-- invited accounts without opening the Supabase dashboard.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
UPDATE public.profiles p SET email = u.email FROM auth.users u WHERE u.id = p.id AND p.email IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique_idx ON public.profiles (lower(email)) WHERE email IS NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE first_user boolean;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.email);
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO first_user;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN first_user THEN 'admin'::public.app_role ELSE 'pharmacist'::public.app_role end);
  RETURN NEW;
END; $$;

-- Active staff only can access clinic records. This makes deactivation effective
-- immediately across all existing policies that call has_role/is_staff.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id AND ur.role = _role AND p.is_active
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id AND p.is_active
  );
$$;

-- Admin-only staff control for accounts created through Supabase invitations.
-- Keeps one active administrator so the clinic cannot lock itself out.
CREATE OR REPLACE FUNCTION public.admin_manage_staff(
  p_user_id uuid,
  p_role public.app_role,
  p_is_active boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_target_is_admin boolean;
  v_active_admins integer;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Only an administrator can manage staff accounts.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Staff account not found.';
  END IF;

  IF p_user_id = v_uid AND NOT p_is_active THEN
    RAISE EXCEPTION 'You cannot deactivate your own account.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = 'admin'
  ) INTO v_target_is_admin;
  SELECT count(*) INTO v_active_admins
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = 'admin' AND p.is_active;

  IF v_target_is_admin AND (p_role <> 'admin' OR NOT p_is_active) AND v_active_admins <= 1 THEN
    RAISE EXCEPTION 'Keep at least one active administrator.';
  END IF;

  UPDATE public.profiles SET is_active = p_is_active WHERE id = p_user_id;
  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (p_user_id, p_role);

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, description, changes)
  VALUES (
    v_uid,
    'manage_staff',
    'staff',
    p_user_id,
    'Administrator updated a staff account',
    jsonb_build_object('role', p_role, 'is_active', p_is_active)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_manage_staff(uuid, public.app_role, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_manage_staff(uuid, public.app_role, boolean) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_manage_staff(uuid, public.app_role, boolean) FROM anon;
