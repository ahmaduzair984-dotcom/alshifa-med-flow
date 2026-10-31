-- Itemized clinic services are separate from medicines: they create revenue
-- and appear on receipts without changing pharmacy stock.
CREATE TABLE IF NOT EXISTS public.clinical_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'IV & Injection',
  price_paisa bigint NOT NULL DEFAULT 0 CHECK (price_paisa >= 0),
  cost_paisa bigint NOT NULL DEFAULT 0 CHECK (cost_paisa >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS clinical_services_name_idx
  ON public.clinical_services (lower(name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_services TO authenticated;
GRANT ALL ON public.clinical_services TO service_role;
ALTER TABLE public.clinical_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read clinical services" ON public.clinical_services;
CREATE POLICY "staff read clinical services" ON public.clinical_services
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "admin create clinical services" ON public.clinical_services;
CREATE POLICY "admin create clinical services" ON public.clinical_services
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin update clinical services" ON public.clinical_services;
CREATE POLICY "admin update clinical services" ON public.clinical_services
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin delete clinical services" ON public.clinical_services;
CREATE POLICY "admin delete clinical services" ON public.clinical_services
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.clinical_services (name, category, price_paisa, cost_paisa, sort_order)
SELECT seed.name, 'IV & Injection', seed.price_paisa, seed.price_paisa, seed.sort_order
FROM (VALUES
  ('Omeprazole + Gravinate IV', 50000::bigint, 10),
  ('Ceftriaxone IV', 80000::bigint, 20),
  ('Normal Saline 500 mL IV', 80000::bigint, 30),
  ('Normal Saline 1000 mL IV', 100000::bigint, 40)
) AS seed(name, price_paisa, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.clinical_services existing
  WHERE lower(existing.name) = lower(seed.name)
);

CREATE TABLE IF NOT EXISTS public.sale_service_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.clinical_services(id) ON DELETE SET NULL,
  service_name text NOT NULL,
  category text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_paisa bigint NOT NULL CHECK (unit_price_paisa >= 0),
  unit_cost_paisa bigint NOT NULL DEFAULT 0 CHECK (unit_cost_paisa >= 0),
  line_total_paisa bigint NOT NULL CHECK (line_total_paisa >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sale_service_items_sale_idx
  ON public.sale_service_items (sale_id);

GRANT SELECT ON public.sale_service_items TO authenticated;
GRANT ALL ON public.sale_service_items TO service_role;
ALTER TABLE public.sale_service_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read sale service items" ON public.sale_service_items;
CREATE POLICY "staff read sale service items" ON public.sale_service_items
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS clinical_service_paisa bigint NOT NULL DEFAULT 0
  CHECK (clinical_service_paisa >= 0);

CREATE OR REPLACE FUNCTION public.admin_remove_clinical_service(p_service_id uuid)
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
    RAISE EXCEPTION 'Only an administrator can remove clinical services.';
  END IF;

  SELECT name INTO v_name FROM public.clinical_services WHERE id = p_service_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'This clinical service no longer exists.'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.sale_service_items WHERE service_id = p_service_id
  ) INTO v_has_history;

  IF v_has_history THEN
    UPDATE public.clinical_services
    SET is_active = false, updated_at = now()
    WHERE id = p_service_id;

    INSERT INTO public.audit_logs (user_id, action, entity, entity_id, description)
    VALUES (v_uid, 'archive', 'clinical_services', p_service_id,
      'Administrator archived clinical service while preserving invoices: ' || v_name);
    RETURN jsonb_build_object('ok', true, 'action', 'archived');
  END IF;

  DELETE FROM public.clinical_services WHERE id = p_service_id;
  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, description)
  VALUES (v_uid, 'delete', 'clinical_services', p_service_id,
    'Administrator permanently deleted unused clinical service: ' || v_name);
  RETURN jsonb_build_object('ok', true, 'action', 'deleted');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_remove_clinical_service(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_remove_clinical_service(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.create_sale(jsonb, uuid, bigint, bigint, text, text, text, bigint);

CREATE OR REPLACE FUNCTION public.create_sale(
  p_items jsonb,
  p_patient_id uuid DEFAULT NULL,
  p_discount_paisa bigint DEFAULT 0,
  p_paid_paisa bigint DEFAULT 0,
  p_payment_method text DEFAULT 'cash',
  p_client_token text DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_service_charge_paisa bigint DEFAULT 0,
  p_services jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sale_id uuid;
  v_invoice text;
  v_item jsonb;
  v_product public.products%ROWTYPE;
  v_service public.clinical_services%ROWTYPE;
  v_batch public.product_batches%ROWTYPE;
  v_need int;
  v_take int;
  v_mult int;
  v_qty int;
  v_line_disc bigint;
  v_unit_price bigint;
  v_line_total bigint;
  v_subtotal bigint := 0;
  v_clinical_service_total bigint := 0;
  v_discount bigint := 0;
  v_service_charge bigint := 0;
  v_cost bigint := 0;
  v_total bigint;
  v_available int;
  v_patient_name text;
  v_existing public.sales%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR NOT public.is_staff(v_uid) THEN
    RAISE EXCEPTION 'You are not allowed to record sales.';
  END IF;

  IF p_client_token IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.sales WHERE client_token = p_client_token;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'sale_id', v_existing.id,
        'invoice_no', v_existing.invoice_no,
        'subtotal_paisa', v_existing.subtotal_paisa,
        'clinical_service_paisa', v_existing.clinical_service_paisa,
        'discount_paisa', v_existing.discount_paisa,
        'service_charge_paisa', v_existing.service_charge_paisa,
        'total_paisa', v_existing.total_paisa,
        'paid_paisa', v_existing.paid_paisa,
        'change_paisa', v_existing.change_paisa,
        'duplicate', true
      );
    END IF;
  END IF;

  IF jsonb_array_length(COALESCE(p_items, '[]'::jsonb)) = 0
     AND jsonb_array_length(COALESCE(p_services, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'The cart is empty.';
  END IF;

  IF p_patient_id IS NOT NULL THEN
    SELECT name INTO v_patient_name FROM public.patients WHERE id = p_patient_id;
  END IF;

  v_invoice := 'INV-' || nextval('public.invoice_seq')::text;
  INSERT INTO public.sales (id, invoice_no, patient_id, patient_name, payment_method, client_token, user_id, note)
  VALUES (gen_random_uuid(), v_invoice, p_patient_id, COALESCE(v_patient_name,'Walk-in Customer'), COALESCE(p_payment_method,'cash'), p_client_token, v_uid, p_note)
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) LOOP
    SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'product_id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'One of the medicines no longer exists.'; END IF;
    IF NOT v_product.is_active THEN RAISE EXCEPTION '% is not available for sale.', v_product.brand_name; END IF;

    v_mult := GREATEST(COALESCE((v_item->>'units_per_sale_unit')::int, 1), 1);
    v_qty := COALESCE((v_item->>'quantity')::int, 0);
    IF v_qty <= 0 THEN RAISE EXCEPTION 'Quantity for % must be greater than zero.', v_product.brand_name; END IF;
    v_need := v_qty * v_mult;
    v_line_disc := GREATEST(COALESCE((v_item->>'discount_paisa')::bigint, 0), 0);
    v_unit_price := v_product.sale_price_paisa * v_mult;
    v_line_total := GREATEST(v_unit_price * v_qty - v_line_disc, 0);

    SELECT COALESCE(SUM(quantity_base),0) INTO v_available FROM public.product_batches
      WHERE product_id = v_product.id AND quantity_base > 0 AND (expiry_date IS NULL OR expiry_date >= current_date);
    IF v_available < v_need THEN
      RAISE EXCEPTION 'Insufficient stock for %. Only % % available.', v_product.brand_name, v_available, v_product.base_unit;
    END IF;

    v_subtotal := v_subtotal + v_line_total;

    WHILE v_need > 0 LOOP
      SELECT * INTO v_batch FROM public.product_batches
        WHERE product_id = v_product.id AND quantity_base > 0 AND (expiry_date IS NULL OR expiry_date >= current_date)
        ORDER BY expiry_date NULLS LAST, created_at
        LIMIT 1 FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient stock for %.', v_product.brand_name; END IF;

      v_take := LEAST(v_need, v_batch.quantity_base);
      UPDATE public.product_batches SET quantity_base = quantity_base - v_take WHERE id = v_batch.id;

      INSERT INTO public.sale_items (sale_id, product_id, batch_id, product_name, batch_number, unit_label,
        units_per_sale_unit, quantity, quantity_base, unit_price_paisa, discount_paisa, line_total_paisa, cost_paisa)
      VALUES (v_sale_id, v_product.id, v_batch.id, v_product.brand_name || COALESCE(' ' || v_product.strength, ''),
        v_batch.batch_number, COALESCE(v_item->>'unit_label', v_product.base_unit), v_mult,
        CEIL(v_take::numeric / v_mult)::int, v_take,
        v_product.sale_price_paisa * v_mult,
        CASE WHEN v_take = v_qty * v_mult THEN v_line_disc ELSE 0 END,
        v_product.sale_price_paisa * v_take - CASE WHEN v_take = v_qty * v_mult THEN v_line_disc ELSE 0 END,
        v_batch.cost_price_paisa * v_take);

      v_cost := v_cost + v_batch.cost_price_paisa * v_take;
      INSERT INTO public.stock_movements (product_id, batch_id, change_base, balance_after, reason, reference_type, reference_id, user_id, note)
      VALUES (v_product.id, v_batch.id, -v_take, v_batch.quantity_base - v_take, 'sale', 'sale', v_sale_id, v_uid, v_invoice);
      v_need := v_need - v_take;
    END LOOP;
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_services, '[]'::jsonb)) LOOP
    SELECT * INTO v_service FROM public.clinical_services
      WHERE id = (v_item->>'service_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'One of the clinical services no longer exists.'; END IF;
    IF NOT v_service.is_active THEN RAISE EXCEPTION '% is no longer available.', v_service.name; END IF;

    v_qty := COALESCE((v_item->>'quantity')::int, 0);
    IF v_qty <= 0 THEN RAISE EXCEPTION 'Quantity for % must be greater than zero.', v_service.name; END IF;
    v_line_total := v_service.price_paisa * v_qty;
    v_clinical_service_total := v_clinical_service_total + v_line_total;
    v_subtotal := v_subtotal + v_line_total;
    v_cost := v_cost + v_service.cost_paisa * v_qty;

    INSERT INTO public.sale_service_items (
      sale_id, service_id, service_name, category, quantity,
      unit_price_paisa, unit_cost_paisa, line_total_paisa
    ) VALUES (
      v_sale_id, v_service.id, v_service.name, v_service.category, v_qty,
      v_service.price_paisa, v_service.cost_paisa, v_line_total
    );
  END LOOP;

  v_discount := LEAST(GREATEST(COALESCE(p_discount_paisa, 0), 0), v_subtotal);
  v_service_charge := GREATEST(COALESCE(p_service_charge_paisa, 0), 0);
  v_total := v_subtotal - v_discount + v_service_charge;

  UPDATE public.sales SET
    subtotal_paisa = v_subtotal,
    clinical_service_paisa = v_clinical_service_total,
    discount_paisa = v_discount,
    service_charge_paisa = v_service_charge,
    total_paisa = v_total,
    paid_paisa = GREATEST(COALESCE(p_paid_paisa,0),0),
    change_paisa = GREATEST(GREATEST(COALESCE(p_paid_paisa,0),0) - v_total, 0),
    cost_paisa = v_cost,
    profit_paisa = v_total - v_cost
  WHERE id = v_sale_id;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, description, changes)
  VALUES (v_uid, 'create', 'sale', v_sale_id, 'Sale ' || v_invoice || ' completed',
    jsonb_build_object(
      'subtotal_paisa', v_subtotal,
      'clinical_service_paisa', v_clinical_service_total,
      'discount_paisa', v_discount,
      'service_charge_paisa', v_service_charge,
      'total_paisa', v_total,
      'items', jsonb_array_length(COALESCE(p_items, '[]'::jsonb)),
      'services', jsonb_array_length(COALESCE(p_services, '[]'::jsonb))
    ));

  RETURN jsonb_build_object(
    'sale_id', v_sale_id,
    'invoice_no', v_invoice,
    'subtotal_paisa', v_subtotal,
    'clinical_service_paisa', v_clinical_service_total,
    'discount_paisa', v_discount,
    'service_charge_paisa', v_service_charge,
    'total_paisa', v_total,
    'paid_paisa', GREATEST(COALESCE(p_paid_paisa,0),0),
    'change_paisa', GREATEST(GREATEST(COALESCE(p_paid_paisa,0),0) - v_total, 0),
    'duplicate', false
  );
END; $$;

REVOKE ALL ON FUNCTION public.create_sale(jsonb, uuid, bigint, bigint, text, text, text, bigint, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_sale(jsonb, uuid, bigint, bigint, text, text, text, bigint, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_sale(jsonb, uuid, bigint, bigint, text, text, text, bigint, jsonb) TO authenticated;
