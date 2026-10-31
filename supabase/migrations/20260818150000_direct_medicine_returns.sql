-- Allow a medicine return without locating the original invoice. The return
-- still records the refund, restores stock, and posts a signed profit
-- adjustment (returned cost minus cash refund).
ALTER TABLE public.sale_returns
  ALTER COLUMN sale_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'invoice',
  ADD COLUMN IF NOT EXISTS cost_paisa bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profit_adjustment_paisa bigint NOT NULL DEFAULT 0;

ALTER TABLE public.return_items
  ALTER COLUMN sale_item_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.product_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cost_paisa bigint NOT NULL DEFAULT 0;

-- Preserve correct reporting for any invoice-linked returns already recorded.
UPDATE public.return_items ri
SET
  batch_id = si.batch_id,
  cost_paisa = ROUND(si.cost_paisa::numeric * ri.quantity_base / NULLIF(si.quantity_base, 0))
FROM public.sale_items si
WHERE ri.sale_item_id = si.id
  AND (ri.batch_id IS NULL OR ri.cost_paisa = 0);

UPDATE public.sale_returns sr
SET
  cost_paisa = totals.cost_paisa,
  profit_adjustment_paisa = totals.cost_paisa - sr.total_paisa
FROM (
  SELECT return_id, COALESCE(SUM(cost_paisa), 0)::bigint AS cost_paisa
  FROM public.return_items
  GROUP BY return_id
) totals
WHERE totals.return_id = sr.id;

CREATE OR REPLACE FUNCTION public.create_direct_return(
  p_items jsonb,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_return_id uuid;
  v_return_no text;
  v_item jsonb;
  v_product public.products%ROWTYPE;
  v_batch public.product_batches%ROWTYPE;
  v_qty int;
  v_refund bigint;
  v_line_cost bigint;
  v_total bigint := 0;
  v_total_cost bigint := 0;
  v_balance int;
  v_return_batch text;
BEGIN
  IF v_uid IS NULL OR NOT public.is_staff(v_uid) THEN
    RAISE EXCEPTION 'You are not allowed to record returns.';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Select at least one medicine to return.';
  END IF;

  v_return_no := 'RET-' || nextval('public.return_seq')::text;
  INSERT INTO public.sale_returns (return_no, sale_id, source, reason, user_id)
  VALUES (v_return_no, NULL, 'direct', NULLIF(trim(p_reason), ''), v_uid)
  RETURNING id INTO v_return_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_product
    FROM public.products
    WHERE id = (v_item->>'product_id')::uuid
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'The selected medicine no longer exists.'; END IF;

    v_qty := COALESCE((v_item->>'quantity_base')::int, 0);
    v_refund := GREATEST(COALESCE((v_item->>'refund_paisa')::bigint, 0), 0);
    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Quantity for % must be greater than zero.', v_product.brand_name;
    END IF;

    -- Prefer the most recently received, unexpired batch. If none exists,
    -- create one stable return batch using the catalogue buying price.
    SELECT * INTO v_batch
    FROM public.product_batches
    WHERE product_id = v_product.id
      AND (expiry_date IS NULL OR expiry_date >= current_date)
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      v_return_batch := 'DIRECT-RETURN-' || to_char(current_date, 'YYYYMMDD');
      INSERT INTO public.product_batches (
        product_id, batch_number, expiry_date, cost_price_paisa,
        quantity_base, initial_quantity_base
      ) VALUES (
        v_product.id, v_return_batch, NULL, v_product.cost_price_paisa,
        v_qty, 0
      )
      ON CONFLICT (product_id, batch_number) DO UPDATE
      SET quantity_base = public.product_batches.quantity_base + EXCLUDED.quantity_base
      RETURNING * INTO v_batch;
      v_balance := v_batch.quantity_base;
    ELSE
      UPDATE public.product_batches
      SET quantity_base = quantity_base + v_qty
      WHERE id = v_batch.id
      RETURNING quantity_base INTO v_balance;
    END IF;

    v_line_cost := v_batch.cost_price_paisa * v_qty;
    v_total := v_total + v_refund;
    v_total_cost := v_total_cost + v_line_cost;

    INSERT INTO public.return_items (
      return_id, sale_item_id, product_id, batch_id, product_name,
      quantity_base, refund_paisa, cost_paisa
    ) VALUES (
      v_return_id, NULL, v_product.id, v_batch.id,
      v_product.brand_name || COALESCE(' ' || v_product.strength, ''),
      v_qty, v_refund, v_line_cost
    );

    INSERT INTO public.stock_movements (
      product_id, batch_id, change_base, balance_after, reason,
      reference_type, reference_id, user_id, note
    ) VALUES (
      v_product.id, v_batch.id, v_qty, v_balance, 'sale_return',
      'sale_return', v_return_id, v_uid, v_return_no || ' (direct return)'
    );
  END LOOP;

  UPDATE public.sale_returns
  SET
    total_paisa = v_total,
    cost_paisa = v_total_cost,
    profit_adjustment_paisa = v_total_cost - v_total
  WHERE id = v_return_id;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, description, changes)
  VALUES (
    v_uid, 'create', 'sale_return', v_return_id,
    'Direct medicine return ' || v_return_no || ' recorded',
    jsonb_build_object(
      'refund_paisa', v_total,
      'returned_cost_paisa', v_total_cost,
      'profit_adjustment_paisa', v_total_cost - v_total
    )
  );

  RETURN jsonb_build_object(
    'return_id', v_return_id,
    'return_no', v_return_no,
    'refund_paisa', v_total,
    'cost_paisa', v_total_cost,
    'profit_adjustment_paisa', v_total_cost - v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_direct_return(jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_direct_return(jsonb, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_return(p_return_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_item record;
  v_deleted int := 0;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Only an administrator can delete returns.';
  END IF;

  FOR v_item IN
    SELECT
      ri.quantity_base,
      ri.sale_item_id,
      COALESCE(ri.batch_id, si.batch_id) AS batch_id
    FROM public.return_items ri
    LEFT JOIN public.sale_items si ON si.id = ri.sale_item_id
    WHERE ri.return_id = p_return_id
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
    IF v_item.sale_item_id IS NOT NULL THEN
      UPDATE public.sale_items
      SET returned_base = returned_base - v_item.quantity_base
      WHERE id = v_item.sale_item_id;
    END IF;
  END LOOP;

  DELETE FROM public.stock_movements
  WHERE reference_type = 'sale_return' AND reference_id = p_return_id;
  DELETE FROM public.sale_returns WHERE id = p_return_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted = 0 THEN RAISE EXCEPTION 'This return no longer exists.'; END IF;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, description)
  VALUES (v_uid, 'delete', 'sale_return', p_return_id, 'Administrator deleted a medicine return');
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_return(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_return(uuid) TO authenticated;
