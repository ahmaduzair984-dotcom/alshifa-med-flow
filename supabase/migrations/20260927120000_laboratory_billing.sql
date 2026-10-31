-- Laboratory billing is deliberately independent from pharmacy sales and stock.
-- Test costs remain server-protected; only the authorized financial RPC exposes them.

CREATE SEQUENCE IF NOT EXISTS public.lab_invoice_seq START 1000;

CREATE TABLE IF NOT EXISTS public.lab_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Laboratory',
  price_paisa bigint NOT NULL DEFAULT 0 CHECK (price_paisa >= 0),
  cost_paisa bigint NOT NULL DEFAULT 0 CHECK (cost_paisa >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS lab_tests_name_idx ON public.lab_tests (lower(name));

CREATE TABLE IF NOT EXISTS public.lab_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no text NOT NULL UNIQUE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  patient_name text NOT NULL,
  patient_age integer CHECK (patient_age IS NULL OR (patient_age >= 0 AND patient_age <= 130)),
  patient_gender text,
  patient_phone text,
  referring_doctor text,
  subtotal_paisa bigint NOT NULL DEFAULT 0 CHECK (subtotal_paisa >= 0),
  discount_paisa bigint NOT NULL DEFAULT 0 CHECK (discount_paisa >= 0),
  total_paisa bigint NOT NULL DEFAULT 0 CHECK (total_paisa >= 0),
  paid_paisa bigint NOT NULL DEFAULT 0 CHECK (paid_paisa >= 0),
  change_paisa bigint NOT NULL DEFAULT 0 CHECK (change_paisa >= 0),
  cost_paisa bigint NOT NULL DEFAULT 0 CHECK (cost_paisa >= 0),
  profit_paisa bigint NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  status text NOT NULL DEFAULT 'completed',
  note text,
  client_token text UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lab_sales_created_idx ON public.lab_sales (created_at DESC);
CREATE INDEX IF NOT EXISTS lab_sales_patient_idx ON public.lab_sales (patient_id);

CREATE TABLE IF NOT EXISTS public.lab_sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_sale_id uuid NOT NULL REFERENCES public.lab_sales(id) ON DELETE CASCADE,
  lab_test_id uuid REFERENCES public.lab_tests(id) ON DELETE SET NULL,
  test_name text NOT NULL,
  category text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_paisa bigint NOT NULL CHECK (unit_price_paisa >= 0),
  unit_cost_paisa bigint NOT NULL DEFAULT 0 CHECK (unit_cost_paisa >= 0),
  line_total_paisa bigint NOT NULL CHECK (line_total_paisa >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lab_sale_items_sale_idx ON public.lab_sale_items (lab_sale_id);

ALTER TABLE public.lab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_sale_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read lab tests" ON public.lab_tests;
CREATE POLICY "staff read lab tests" ON public.lab_tests
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "managers create lab tests" ON public.lab_tests;
CREATE POLICY "managers create lab tests" ON public.lab_tests
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "managers update lab tests" ON public.lab_tests;
CREATE POLICY "managers update lab tests" ON public.lab_tests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "admin delete lab tests" ON public.lab_tests;
CREATE POLICY "admin delete lab tests" ON public.lab_tests
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "staff read lab sales" ON public.lab_sales;
CREATE POLICY "staff read lab sales" ON public.lab_sales
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "staff read lab sale items" ON public.lab_sale_items;
CREATE POLICY "staff read lab sale items" ON public.lab_sale_items
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

REVOKE ALL ON public.lab_tests, public.lab_sales, public.lab_sale_items FROM anon, authenticated;

-- Staff can see sale prices, but not the clinic's test costs or lab profit.
GRANT SELECT (id, name, category, price_paisa, is_active, sort_order, created_at, updated_at)
  ON public.lab_tests TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.lab_tests TO authenticated;

GRANT SELECT (
  id, invoice_no, patient_id, patient_name, patient_age, patient_gender, patient_phone,
  referring_doctor, subtotal_paisa, discount_paisa, total_paisa, paid_paisa,
  change_paisa, payment_method, status, note, created_at
) ON public.lab_sales TO authenticated;

GRANT SELECT (
  id, lab_sale_id, lab_test_id, test_name, category, quantity,
  unit_price_paisa, line_total_paisa, created_at
) ON public.lab_sale_items TO authenticated;

GRANT ALL ON public.lab_tests, public.lab_sales, public.lab_sale_items TO service_role;

CREATE OR REPLACE FUNCTION public.create_lab_sale(
  p_items jsonb,
  p_patient_id uuid DEFAULT NULL,
  p_patient_name text DEFAULT NULL,
  p_patient_age integer DEFAULT NULL,
  p_patient_gender text DEFAULT NULL,
  p_patient_phone text DEFAULT NULL,
  p_referring_doctor text DEFAULT NULL,
  p_discount_paisa bigint DEFAULT 0,
  p_paid_paisa bigint DEFAULT 0,
  p_payment_method text DEFAULT 'cash',
  p_client_token text DEFAULT NULL,
  p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sale_id uuid;
  v_patient_id uuid := p_patient_id;
  v_patient_name text := nullif(btrim(COALESCE(p_patient_name, '')), '');
  v_patient_age integer := p_patient_age;
  v_patient_gender text := nullif(btrim(COALESCE(p_patient_gender, '')), '');
  v_patient_phone text := nullif(btrim(COALESCE(p_patient_phone, '')), '');
  v_invoice text;
  v_item jsonb;
  v_test public.lab_tests%ROWTYPE;
  v_existing public.lab_sales%ROWTYPE;
  v_qty integer;
  v_line_total bigint;
  v_subtotal bigint := 0;
  v_discount bigint := 0;
  v_total bigint := 0;
  v_paid bigint := 0;
  v_cost bigint := 0;
BEGIN
  IF v_uid IS NULL OR NOT public.is_staff(v_uid) THEN
    RAISE EXCEPTION 'You are not allowed to record laboratory sales.';
  END IF;

  IF p_client_token IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.lab_sales WHERE client_token = p_client_token;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'lab_sale_id', v_existing.id,
        'invoice_no', v_existing.invoice_no,
        'patient_id', v_existing.patient_id,
        'patient_name', v_existing.patient_name,
        'subtotal_paisa', v_existing.subtotal_paisa,
        'discount_paisa', v_existing.discount_paisa,
        'total_paisa', v_existing.total_paisa,
        'paid_paisa', v_existing.paid_paisa,
        'change_paisa', v_existing.change_paisa,
        'duplicate', true
      );
    END IF;
  END IF;

  IF jsonb_array_length(COALESCE(p_items, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Add at least one laboratory test.';
  END IF;
  IF v_patient_name IS NULL THEN
    RAISE EXCEPTION 'Patient name is required.';
  END IF;
  IF v_patient_age IS NOT NULL AND (v_patient_age < 0 OR v_patient_age > 130) THEN
    RAISE EXCEPTION 'Enter a valid patient age.';
  END IF;

  IF v_patient_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.patients WHERE id = v_patient_id) THEN
      RAISE EXCEPTION 'The selected patient no longer exists.';
    END IF;
  ELSE
    INSERT INTO public.patients (name, age, gender, phone, notes)
    VALUES (
      v_patient_name,
      v_patient_age,
      v_patient_gender,
      v_patient_phone,
      'Created automatically from laboratory billing.'
    )
    RETURNING id INTO v_patient_id;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) LOOP
    SELECT * INTO v_test
    FROM public.lab_tests
    WHERE id = (v_item->>'lab_test_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'One of the laboratory tests no longer exists.'; END IF;
    IF NOT v_test.is_active THEN RAISE EXCEPTION '% is no longer available.', v_test.name; END IF;

    v_qty := COALESCE((v_item->>'quantity')::integer, 0);
    IF v_qty <= 0 THEN RAISE EXCEPTION 'Quantity for % must be greater than zero.', v_test.name; END IF;
    v_line_total := v_test.price_paisa * v_qty;
    v_subtotal := v_subtotal + v_line_total;
    v_cost := v_cost + v_test.cost_paisa * v_qty;
  END LOOP;

  v_discount := LEAST(GREATEST(COALESCE(p_discount_paisa, 0), 0), v_subtotal);
  v_total := v_subtotal - v_discount;
  v_paid := GREATEST(COALESCE(p_paid_paisa, 0), 0);
  v_invoice := 'LAB-' || lpad(nextval('public.lab_invoice_seq')::text, 6, '0');

  INSERT INTO public.lab_sales (
    invoice_no, patient_id, patient_name, patient_age, patient_gender, patient_phone,
    referring_doctor, subtotal_paisa, discount_paisa, total_paisa, paid_paisa,
    change_paisa, cost_paisa, profit_paisa, payment_method, status, note,
    client_token, user_id
  ) VALUES (
    v_invoice, v_patient_id, v_patient_name, v_patient_age, v_patient_gender, v_patient_phone,
    nullif(btrim(COALESCE(p_referring_doctor, '')), ''), v_subtotal, v_discount, v_total,
    v_paid, GREATEST(v_paid - v_total, 0), v_cost, v_total - v_cost,
    COALESCE(NULLIF(p_payment_method, ''), 'cash'), 'completed', p_note,
    p_client_token, v_uid
  ) RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) LOOP
    SELECT * INTO v_test FROM public.lab_tests WHERE id = (v_item->>'lab_test_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    v_line_total := v_test.price_paisa * v_qty;
    INSERT INTO public.lab_sale_items (
      lab_sale_id, lab_test_id, test_name, category, quantity,
      unit_price_paisa, unit_cost_paisa, line_total_paisa
    ) VALUES (
      v_sale_id, v_test.id, v_test.name, v_test.category, v_qty,
      v_test.price_paisa, v_test.cost_paisa, v_line_total
    );
  END LOOP;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, description, changes)
  VALUES (
    v_uid, 'create', 'lab_sale', v_sale_id, 'Laboratory sale ' || v_invoice || ' completed',
    jsonb_build_object('total_paisa', v_total, 'tests', jsonb_array_length(p_items))
  );

  RETURN jsonb_build_object(
    'lab_sale_id', v_sale_id,
    'invoice_no', v_invoice,
    'patient_id', v_patient_id,
    'patient_name', v_patient_name,
    'subtotal_paisa', v_subtotal,
    'discount_paisa', v_discount,
    'total_paisa', v_total,
    'paid_paisa', v_paid,
    'change_paisa', GREATEST(v_paid - v_total, 0),
    'duplicate', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_lab_sale(
  jsonb, uuid, text, integer, text, text, text, bigint, bigint, text, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_lab_sale(
  jsonb, uuid, text, integer, text, text, text, bigint, bigint, text, text, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_lab_tests_with_costs()
RETURNS TABLE (
  id uuid,
  name text,
  category text,
  price_paisa bigint,
  cost_paisa bigint,
  is_active boolean,
  sort_order integer,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  ) THEN
    RAISE EXCEPTION 'You are not allowed to view laboratory costs.';
  END IF;
  RETURN QUERY
  SELECT t.id, t.name, t.category, t.price_paisa, t.cost_paisa,
         t.is_active, t.sort_order, t.created_at, t.updated_at
  FROM public.lab_tests t
  ORDER BY t.sort_order, t.name;
END;
$$;

REVOKE ALL ON FUNCTION public.list_lab_tests_with_costs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_lab_tests_with_costs() TO authenticated;

CREATE OR REPLACE FUNCTION public.lab_financial_summary(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only an administrator can view laboratory profit.';
  END IF;
  SELECT jsonb_build_object(
    'count', count(*),
    'revenue_paisa', COALESCE(sum(total_paisa), 0),
    'subtotal_paisa', COALESCE(sum(subtotal_paisa), 0),
    'discount_paisa', COALESCE(sum(discount_paisa), 0),
    'cost_paisa', COALESCE(sum(cost_paisa), 0),
    'profit_paisa', COALESCE(sum(profit_paisa), 0)
  ) INTO v_result
  FROM public.lab_sales
  WHERE status = 'completed'
    AND created_at >= p_from::timestamptz
    AND created_at < (p_to + 1)::timestamptz;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.lab_financial_summary(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lab_financial_summary(date, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.lab_backup_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only an administrator can back up laboratory financial data.';
  END IF;
  RETURN jsonb_build_object(
    'lab_tests', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.lab_tests t), '[]'::jsonb),
    'lab_sales', COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM public.lab_sales s), '[]'::jsonb),
    'lab_sale_items', COALESCE((SELECT jsonb_agg(to_jsonb(i)) FROM public.lab_sale_items i), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.lab_backup_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lab_backup_data() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_remove_lab_test(p_lab_test_id uuid)
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
    RAISE EXCEPTION 'Only an administrator can remove laboratory tests.';
  END IF;
  SELECT name INTO v_name FROM public.lab_tests WHERE id = p_lab_test_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'This laboratory test no longer exists.'; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.lab_sale_items WHERE lab_test_id = p_lab_test_id
  ) INTO v_has_history;
  IF v_has_history THEN
    UPDATE public.lab_tests SET is_active = false, updated_at = now() WHERE id = p_lab_test_id;
    INSERT INTO public.audit_logs (user_id, action, entity, entity_id, description)
    VALUES (v_uid, 'archive', 'lab_tests', p_lab_test_id,
      'Administrator archived laboratory test while preserving bills: ' || v_name);
    RETURN jsonb_build_object('ok', true, 'action', 'archived');
  END IF;
  DELETE FROM public.lab_tests WHERE id = p_lab_test_id;
  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, description)
  VALUES (v_uid, 'delete', 'lab_tests', p_lab_test_id,
    'Administrator permanently deleted unused laboratory test: ' || v_name);
  RETURN jsonb_build_object('ok', true, 'action', 'deleted');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_remove_lab_test(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_remove_lab_test(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_lab_sale(p_lab_sale_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_invoice text;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Only an administrator can delete laboratory sales.';
  END IF;
  SELECT invoice_no INTO v_invoice FROM public.lab_sales WHERE id = p_lab_sale_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'This laboratory sale no longer exists.'; END IF;
  DELETE FROM public.lab_sales WHERE id = p_lab_sale_id;
  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, description)
  VALUES (v_uid, 'delete', 'lab_sales', p_lab_sale_id,
    'Administrator deleted laboratory sale ' || v_invoice);
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_lab_sale(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_lab_sale(uuid) TO authenticated;
