-- Deletion is intentionally an administrator-only capability. Existing
-- manager/staff policies are split into create/update and delete policies.

DROP POLICY IF EXISTS "manage categories" ON public.categories;
CREATE POLICY "manage categories create" ON public.categories FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "manage categories update" ON public.categories FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "admin delete categories" ON public.categories FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "manage suppliers" ON public.suppliers;
CREATE POLICY "manage suppliers create" ON public.suppliers FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "manage suppliers update" ON public.suppliers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "admin delete suppliers" ON public.suppliers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "staff write patients" ON public.patients;
CREATE POLICY "staff create patients" ON public.patients FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "staff update patients" ON public.patients FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "admin delete patients" ON public.patients FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "manage products" ON public.products;
CREATE POLICY "manage products create" ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "manage products update" ON public.products FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "admin delete products" ON public.products FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "manage batches" ON public.product_batches;
CREATE POLICY "manage batches create" ON public.product_batches FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "manage batches update" ON public.product_batches FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "admin delete batches" ON public.product_batches FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "manage expenses" ON public.expenses;
CREATE POLICY "manage expenses create" ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "manage expenses update" ON public.expenses FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "admin delete expenses" ON public.expenses FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- This single, audited function is the only deletion path the app uses.
-- Transactions are reversed before their record is removed, so stock stays
-- correct. A deletion is refused when it would make stock or history invalid.
CREATE OR REPLACE FUNCTION public.admin_delete_record(
  p_table text,
  p_record_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_deleted integer := 0;
  v_item record;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Only an administrator can delete records.';
  END IF;

  CASE p_table
    WHEN 'products', 'patients', 'suppliers', 'expenses' THEN
      EXECUTE format('DELETE FROM public.%I WHERE id = $1', p_table) USING p_record_id;
      GET DIAGNOSTICS v_deleted = ROW_COUNT;

    WHEN 'sales' THEN
      IF EXISTS (SELECT 1 FROM public.sale_returns WHERE sale_id = p_record_id) THEN
        RAISE EXCEPTION 'Delete the related return before deleting this sale.';
      END IF;

      FOR v_item IN
        SELECT batch_id, quantity_base FROM public.sale_items WHERE sale_id = p_record_id
      LOOP
        IF v_item.batch_id IS NULL THEN
          RAISE EXCEPTION 'This sale cannot be deleted because its stock batch is unavailable.';
        END IF;
        UPDATE public.product_batches
        SET quantity_base = quantity_base + v_item.quantity_base
        WHERE id = v_item.batch_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'This sale cannot be deleted because its stock batch no longer exists.';
        END IF;
      END LOOP;

      DELETE FROM public.stock_movements
      WHERE reference_type = 'sale' AND reference_id = p_record_id;
      DELETE FROM public.sales WHERE id = p_record_id;
      GET DIAGNOSTICS v_deleted = ROW_COUNT;

    WHEN 'sale_returns' THEN
      FOR v_item IN
        SELECT ri.quantity_base, ri.sale_item_id, si.batch_id
        FROM public.return_items ri
        JOIN public.sale_items si ON si.id = ri.sale_item_id
        WHERE ri.return_id = p_record_id
      LOOP
        IF v_item.batch_id IS NULL THEN
          RAISE EXCEPTION 'This return cannot be deleted because its stock batch is unavailable.';
        END IF;
        UPDATE public.product_batches
        SET quantity_base = quantity_base - v_item.quantity_base
        WHERE id = v_item.batch_id AND quantity_base >= v_item.quantity_base;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'This return cannot be deleted because its returned stock has already been used.';
        END IF;
        UPDATE public.sale_items
        SET returned_base = returned_base - v_item.quantity_base
        WHERE id = v_item.sale_item_id;
      END LOOP;

      DELETE FROM public.stock_movements
      WHERE reference_type = 'sale_return' AND reference_id = p_record_id;
      DELETE FROM public.sale_returns WHERE id = p_record_id;
      GET DIAGNOSTICS v_deleted = ROW_COUNT;

    WHEN 'purchases' THEN
      FOR v_item IN
        SELECT batch_id, quantity_base FROM public.purchase_items WHERE purchase_id = p_record_id
      LOOP
        IF v_item.batch_id IS NULL THEN
          RAISE EXCEPTION 'This purchase cannot be deleted because its stock batch is unavailable.';
        END IF;
        IF EXISTS (SELECT 1 FROM public.sale_items WHERE batch_id = v_item.batch_id) THEN
          RAISE EXCEPTION 'This purchase cannot be deleted because medicines from its batch have been sold.';
        END IF;
        UPDATE public.product_batches
        SET quantity_base = quantity_base - v_item.quantity_base,
            initial_quantity_base = initial_quantity_base - v_item.quantity_base
        WHERE id = v_item.batch_id
          AND quantity_base >= v_item.quantity_base
          AND initial_quantity_base >= v_item.quantity_base;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'This purchase cannot be deleted because its stock has already been used.';
        END IF;
      END LOOP;

      DELETE FROM public.stock_movements
      WHERE reference_type = 'purchase' AND reference_id = p_record_id;
      DELETE FROM public.purchases WHERE id = p_record_id;
      GET DIAGNOSTICS v_deleted = ROW_COUNT;

    ELSE
      RAISE EXCEPTION 'Deleting this type of record is not supported.';
  END CASE;

  IF v_deleted = 0 THEN
    RAISE EXCEPTION 'This record no longer exists.';
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, description)
  VALUES (v_uid, 'delete', p_table, p_record_id, 'Administrator deleted a ' || replace(p_table, '_', ' ') || ' record');

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_record(text, uuid) TO authenticated;
