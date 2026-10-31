-- Permit an itemized, one-off procedure to be recorded directly in New Sale.
-- Named procedures share the existing sale_service_items ledger, so they are
-- included in invoice history and financial reports without changing medicine stock.
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
  v_unit_cost bigint;
  v_line_total bigint;
  v_service_name text;
  v_service_category text;
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
  INSERT INTO public.sales (
    id, invoice_no, patient_id, patient_name, payment_method, client_token, user_id, note
  ) VALUES (
    gen_random_uuid(), v_invoice, p_patient_id,
    COALESCE(v_patient_name, 'Walk-in Customer'),
    COALESCE(p_payment_method, 'cash'), p_client_token, v_uid, p_note
  ) RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) LOOP
    SELECT * INTO v_product
    FROM public.products
    WHERE id = (v_item->>'product_id')::uuid
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'One of the medicines no longer exists.'; END IF;
    IF NOT v_product.is_active THEN
      RAISE EXCEPTION '% is not available for sale.', v_product.brand_name;
    END IF;

    v_mult := GREATEST(COALESCE((v_item->>'units_per_sale_unit')::int, 1), 1);
    v_qty := COALESCE((v_item->>'quantity')::int, 0);
    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Quantity for % must be greater than zero.', v_product.brand_name;
    END IF;
    v_need := v_qty * v_mult;
    v_line_disc := GREATEST(COALESCE((v_item->>'discount_paisa')::bigint, 0), 0);
    v_unit_price := v_product.sale_price_paisa * v_mult;
    v_line_total := GREATEST(v_unit_price * v_qty - v_line_disc, 0);

    SELECT COALESCE(SUM(quantity_base), 0) INTO v_available
    FROM public.product_batches
    WHERE product_id = v_product.id
      AND quantity_base > 0
      AND (expiry_date IS NULL OR expiry_date >= current_date);

    IF v_available < v_need THEN
      RAISE EXCEPTION 'Insufficient stock for %. Only % % available.',
        v_product.brand_name, v_available, v_product.base_unit;
    END IF;

    v_subtotal := v_subtotal + v_line_total;

    WHILE v_need > 0 LOOP
      SELECT * INTO v_batch
      FROM public.product_batches
      WHERE product_id = v_product.id
        AND quantity_base > 0
        AND (expiry_date IS NULL OR expiry_date >= current_date)
      ORDER BY expiry_date NULLS LAST, created_at
      LIMIT 1 FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient stock for %.', v_product.brand_name;
      END IF;

      v_take := LEAST(v_need, v_batch.quantity_base);
      UPDATE public.product_batches
      SET quantity_base = quantity_base - v_take
      WHERE id = v_batch.id;

      INSERT INTO public.sale_items (
        sale_id, product_id, batch_id, product_name, batch_number, unit_label,
        units_per_sale_unit, quantity, quantity_base, unit_price_paisa,
        discount_paisa, line_total_paisa, cost_paisa
      ) VALUES (
        v_sale_id, v_product.id, v_batch.id,
        v_product.brand_name || COALESCE(' ' || v_product.strength, ''),
        v_batch.batch_number, COALESCE(v_item->>'unit_label', v_product.base_unit),
        v_mult, CEIL(v_take::numeric / v_mult)::int, v_take,
        v_product.sale_price_paisa * v_mult,
        CASE WHEN v_take = v_qty * v_mult THEN v_line_disc ELSE 0 END,
        v_product.sale_price_paisa * v_take
          - CASE WHEN v_take = v_qty * v_mult THEN v_line_disc ELSE 0 END,
        v_batch.cost_price_paisa * v_take
      );

      v_cost := v_cost + v_batch.cost_price_paisa * v_take;
      INSERT INTO public.stock_movements (
        product_id, batch_id, change_base, balance_after, reason,
        reference_type, reference_id, user_id, note
      ) VALUES (
        v_product.id, v_batch.id, -v_take, v_batch.quantity_base - v_take,
        'sale', 'sale', v_sale_id, v_uid, v_invoice
      );
      v_need := v_need - v_take;
    END LOOP;
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_services, '[]'::jsonb)) LOOP
    v_qty := COALESCE((v_item->>'quantity')::int, 1);
    IF v_qty <= 0 THEN RAISE EXCEPTION 'Procedure quantity must be greater than zero.'; END IF;

    IF NULLIF(BTRIM(COALESCE(v_item->>'service_id', '')), '') IS NOT NULL THEN
      SELECT * INTO v_service
      FROM public.clinical_services
      WHERE id = (v_item->>'service_id')::uuid;

      IF NOT FOUND THEN RAISE EXCEPTION 'One of the clinical services no longer exists.'; END IF;
      IF NOT v_service.is_active THEN
        RAISE EXCEPTION '% is no longer available.', v_service.name;
      END IF;

      v_service_name := v_service.name;
      v_service_category := v_service.category;
      v_unit_price := v_service.price_paisa;
      v_unit_cost := v_service.cost_paisa;
    ELSE
      v_service_name := NULLIF(BTRIM(COALESCE(v_item->>'service_name', '')), '');
      IF v_service_name IS NULL THEN RAISE EXCEPTION 'Enter the procedure name.'; END IF;
      IF LENGTH(v_service_name) > 120 THEN
        RAISE EXCEPTION 'The procedure name must be 120 characters or fewer.';
      END IF;

      v_service_category := COALESCE(
        NULLIF(BTRIM(COALESCE(v_item->>'category', '')), ''),
        'Procedure'
      );
      v_unit_price := GREATEST(COALESCE((v_item->>'unit_price_paisa')::bigint, 0), 0);
      v_unit_cost := GREATEST(COALESCE((v_item->>'unit_cost_paisa')::bigint, 0), 0);
      IF v_unit_price <= 0 THEN
        RAISE EXCEPTION 'The procedure charge must be greater than zero.';
      END IF;
    END IF;

    v_line_total := v_unit_price * v_qty;
    v_clinical_service_total := v_clinical_service_total + v_line_total;
    v_subtotal := v_subtotal + v_line_total;
    v_cost := v_cost + v_unit_cost * v_qty;

    INSERT INTO public.sale_service_items (
      sale_id, service_id, service_name, category, quantity,
      unit_price_paisa, unit_cost_paisa, line_total_paisa
    ) VALUES (
      v_sale_id,
      CASE
        WHEN NULLIF(BTRIM(COALESCE(v_item->>'service_id', '')), '') IS NULL THEN NULL
        ELSE v_service.id
      END,
      v_service_name, v_service_category, v_qty,
      v_unit_price, v_unit_cost, v_line_total
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
    paid_paisa = GREATEST(COALESCE(p_paid_paisa, 0), 0),
    change_paisa = GREATEST(GREATEST(COALESCE(p_paid_paisa, 0), 0) - v_total, 0),
    cost_paisa = v_cost,
    profit_paisa = v_total - v_cost
  WHERE id = v_sale_id;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, description, changes)
  VALUES (
    v_uid, 'create', 'sale', v_sale_id, 'Sale ' || v_invoice || ' completed',
    jsonb_build_object(
      'subtotal_paisa', v_subtotal,
      'clinical_service_paisa', v_clinical_service_total,
      'discount_paisa', v_discount,
      'service_charge_paisa', v_service_charge,
      'total_paisa', v_total,
      'items', jsonb_array_length(COALESCE(p_items, '[]'::jsonb)),
      'services', jsonb_array_length(COALESCE(p_services, '[]'::jsonb))
    )
  );

  RETURN jsonb_build_object(
    'sale_id', v_sale_id,
    'invoice_no', v_invoice,
    'subtotal_paisa', v_subtotal,
    'clinical_service_paisa', v_clinical_service_total,
    'discount_paisa', v_discount,
    'service_charge_paisa', v_service_charge,
    'total_paisa', v_total,
    'paid_paisa', GREATEST(COALESCE(p_paid_paisa, 0), 0),
    'change_paisa', GREATEST(GREATEST(COALESCE(p_paid_paisa, 0), 0) - v_total, 0),
    'duplicate', false
  );
END; $$;

REVOKE ALL ON FUNCTION public.create_sale(
  jsonb, uuid, bigint, bigint, text, text, text, bigint, jsonb
) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_sale(
  jsonb, uuid, bigint, bigint, text, text, text, bigint, jsonb
) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_sale(
  jsonb, uuid, bigint, bigint, text, text, text, bigint, jsonb
) TO authenticated;
