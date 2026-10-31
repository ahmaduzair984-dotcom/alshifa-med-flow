-- Removing a medicine must not erase sales, purchases, returns, or financial
-- history. Unused catalogue entries can be deleted; used ones are archived.
CREATE OR REPLACE FUNCTION public.admin_remove_medicine(p_product_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text;
  v_has_history boolean;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Only an administrator can remove medicines.';
  END IF;

  SELECT brand_name
  INTO v_name
  FROM public.products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This medicine no longer exists.';
  END IF;

  SELECT
    EXISTS (SELECT 1 FROM public.sale_items WHERE product_id = p_product_id)
    OR EXISTS (SELECT 1 FROM public.purchase_items WHERE product_id = p_product_id)
    OR EXISTS (SELECT 1 FROM public.return_items WHERE product_id = p_product_id)
  INTO v_has_history;

  IF v_has_history THEN
    UPDATE public.products
    SET is_active = false,
        updated_at = now()
    WHERE id = p_product_id;

    INSERT INTO public.audit_logs (user_id, action, entity, entity_id, description)
    VALUES (
      v_uid,
      'archive',
      'products',
      p_product_id,
      'Administrator removed medicine from active use while preserving history: ' || v_name
    );

    RETURN jsonb_build_object('ok', true, 'action', 'archived');
  END IF;

  DELETE FROM public.products WHERE id = p_product_id;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, description)
  VALUES (
    v_uid,
    'delete',
    'products',
    p_product_id,
    'Administrator permanently deleted unused medicine: ' || v_name
  );

  RETURN jsonb_build_object('ok', true, 'action', 'deleted');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_remove_medicine(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_remove_medicine(uuid) TO authenticated;
