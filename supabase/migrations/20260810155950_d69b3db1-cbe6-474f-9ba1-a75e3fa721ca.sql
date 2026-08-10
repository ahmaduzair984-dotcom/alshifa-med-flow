
-- ROLES ---------------------------------------------------------------
CREATE TYPE public.app_role AS ENUM ('admin','manager','pharmacist');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE first_user boolean;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)));
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO first_user;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN first_user THEN 'admin'::public.app_role ELSE 'pharmacist'::public.app_role end);
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY "staff read profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "staff read roles" ON public.user_roles FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- SETTINGS ------------------------------------------------------------
CREATE TABLE public.settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  clinic_name text NOT NULL DEFAULT 'AL SHIFA FAMILY CLINIC',
  doctor_name text NOT NULL DEFAULT 'Dr. Saqlain Abbas Chattha',
  address text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  currency text NOT NULL DEFAULT 'Rs.',
  invoice_footer text NOT NULL DEFAULT 'Thank you for visiting Al Shifa Family Clinic. Get well soon.',
  expiry_warning_days int NOT NULL DEFAULT 90,
  low_stock_default int NOT NULL DEFAULT 10,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read settings" ON public.settings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admin write settings" ON public.settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.settings (id) VALUES (1);

-- CATALOG -------------------------------------------------------------
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read categories" ON public.categories FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "manage categories" ON public.categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company text,
  contact_person text,
  phone text,
  email text,
  address text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read suppliers" ON public.suppliers FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "manage suppliers" ON public.suppliers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE TABLE public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('PT-' || lpad((floor(random()*99999)+1)::text, 5, '0')),
  name text NOT NULL,
  phone text,
  age int,
  gender text,
  address text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read patients" ON public.patients FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff write patients" ON public.patients FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name text NOT NULL,
  generic_name text,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  strength text,
  dosage_form text,
  manufacturer text,
  base_unit text NOT NULL DEFAULT 'Tablet',
  pack_unit text,
  units_per_pack int NOT NULL DEFAULT 1 CHECK (units_per_pack > 0),
  carton_unit text,
  packs_per_carton int NOT NULL DEFAULT 1 CHECK (packs_per_carton > 0),
  sale_price_paisa bigint NOT NULL DEFAULT 0 CHECK (sale_price_paisa >= 0),
  cost_price_paisa bigint NOT NULL DEFAULT 0 CHECK (cost_price_paisa >= 0),
  min_stock int NOT NULL DEFAULT 10 CHECK (min_stock >= 0),
  barcode text UNIQUE,
  prescription_required boolean NOT NULL DEFAULT false,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_search_idx ON public.products USING gin (to_tsvector('simple', coalesce(brand_name,'')||' '||coalesce(generic_name,'')||' '||coalesce(strength,'')));
CREATE INDEX products_brand_idx ON public.products (lower(brand_name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read products" ON public.products FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "manage products" ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE TABLE public.product_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_number text NOT NULL,
  expiry_date date,
  cost_price_paisa bigint NOT NULL DEFAULT 0 CHECK (cost_price_paisa >= 0),
  quantity_base int NOT NULL DEFAULT 0 CHECK (quantity_base >= 0),
  initial_quantity_base int NOT NULL DEFAULT 0,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, batch_number)
);
CREATE INDEX batches_product_expiry_idx ON public.product_batches (product_id, expiry_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_batches TO authenticated;
GRANT ALL ON public.product_batches TO service_role;
ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read batches" ON public.product_batches FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "manage batches" ON public.product_batches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE TYPE public.movement_reason AS ENUM ('purchase','sale','sale_return','purchase_return','damage','expired','adjustment','correction','opening');

CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.product_batches(id) ON DELETE SET NULL,
  change_base int NOT NULL,
  balance_after int,
  reason public.movement_reason NOT NULL,
  reference_type text,
  reference_id uuid,
  note text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX movements_product_idx ON public.stock_movements (product_id, created_at DESC);
GRANT SELECT, INSERT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read movements" ON public.stock_movements FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff insert movements" ON public.stock_movements FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- SALES ---------------------------------------------------------------
CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no text NOT NULL UNIQUE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  patient_name text,
  subtotal_paisa bigint NOT NULL DEFAULT 0,
  discount_paisa bigint NOT NULL DEFAULT 0,
  total_paisa bigint NOT NULL DEFAULT 0,
  paid_paisa bigint NOT NULL DEFAULT 0,
  change_paisa bigint NOT NULL DEFAULT 0,
  cost_paisa bigint NOT NULL DEFAULT 0,
  profit_paisa bigint NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  status text NOT NULL DEFAULT 'completed',
  note text,
  client_token text UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sales_created_idx ON public.sales (created_at DESC);
GRANT SELECT ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read sales" ON public.sales FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  batch_id uuid REFERENCES public.product_batches(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  batch_number text,
  unit_label text NOT NULL DEFAULT 'Tablet',
  units_per_sale_unit int NOT NULL DEFAULT 1,
  quantity int NOT NULL,
  quantity_base int NOT NULL,
  returned_base int NOT NULL DEFAULT 0,
  unit_price_paisa bigint NOT NULL,
  discount_paisa bigint NOT NULL DEFAULT 0,
  line_total_paisa bigint NOT NULL,
  cost_paisa bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sale_items_sale_idx ON public.sale_items (sale_id);
CREATE INDEX sale_items_product_idx ON public.sale_items (product_id);
GRANT SELECT ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read sale items" ON public.sale_items FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- PURCHASES -----------------------------------------------------------
CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  purchase_date date NOT NULL DEFAULT current_date,
  subtotal_paisa bigint NOT NULL DEFAULT 0,
  discount_paisa bigint NOT NULL DEFAULT 0,
  total_paisa bigint NOT NULL DEFAULT 0,
  paid_paisa bigint NOT NULL DEFAULT 0,
  note text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read purchases" ON public.purchases FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE TABLE public.purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  batch_id uuid REFERENCES public.product_batches(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  batch_number text,
  expiry_date date,
  quantity_base int NOT NULL,
  cost_price_paisa bigint NOT NULL,
  line_total_paisa bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.purchase_items TO authenticated;
GRANT ALL ON public.purchase_items TO service_role;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read purchase items" ON public.purchase_items FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- RETURNS -------------------------------------------------------------
CREATE TABLE public.sale_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_no text NOT NULL UNIQUE,
  sale_id uuid NOT NULL REFERENCES public.sales(id),
  total_paisa bigint NOT NULL DEFAULT 0,
  reason text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sale_returns TO authenticated;
GRANT ALL ON public.sale_returns TO service_role;
ALTER TABLE public.sale_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read returns" ON public.sale_returns FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE TABLE public.return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.sale_returns(id) ON DELETE CASCADE,
  sale_item_id uuid NOT NULL REFERENCES public.sale_items(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  product_name text NOT NULL,
  quantity_base int NOT NULL,
  refund_paisa bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.return_items TO authenticated;
GRANT ALL ON public.return_items TO service_role;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read return items" ON public.return_items FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- EXPENSES ------------------------------------------------------------
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date date NOT NULL DEFAULT current_date,
  category text NOT NULL,
  description text,
  amount_paisa bigint NOT NULL CHECK (amount_paisa >= 0),
  payment_method text NOT NULL DEFAULT 'cash',
  notes text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read expenses" ON public.expenses FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "manage expenses" ON public.expenses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- AUDIT ---------------------------------------------------------------
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  description text,
  changes jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_created_idx ON public.audit_logs (created_at DESC);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read audit" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "staff insert audit" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- BUSINESS LOGIC ------------------------------------------------------
CREATE SEQUENCE public.invoice_seq START 1000;
CREATE SEQUENCE public.return_seq START 100;

CREATE OR REPLACE FUNCTION public.create_sale(
  p_items jsonb,
  p_patient_id uuid DEFAULT NULL,
  p_discount_paisa bigint DEFAULT 0,
  p_paid_paisa bigint DEFAULT 0,
  p_payment_method text DEFAULT 'cash',
  p_client_token text DEFAULT NULL,
  p_note text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sale_id uuid;
  v_invoice text;
  v_item jsonb;
  v_product public.products%ROWTYPE;
  v_batch public.product_batches%ROWTYPE;
  v_need int;
  v_take int;
  v_mult int;
  v_qty int;
  v_line_disc bigint;
  v_unit_price bigint;
  v_line_total bigint;
  v_subtotal bigint := 0;
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
      RETURN jsonb_build_object('sale_id', v_existing.id, 'invoice_no', v_existing.invoice_no, 'duplicate', true);
    END IF;
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'The cart is empty.';
  END IF;

  IF p_patient_id IS NOT NULL THEN
    SELECT name INTO v_patient_name FROM public.patients WHERE id = p_patient_id;
  END IF;

  v_invoice := 'INV-' || nextval('public.invoice_seq')::text;
  INSERT INTO public.sales (id, invoice_no, patient_id, patient_name, payment_method, client_token, user_id, note)
  VALUES (gen_random_uuid(), v_invoice, p_patient_id, COALESCE(v_patient_name,'Walk-in Customer'), COALESCE(p_payment_method,'cash'), p_client_token, v_uid, p_note)
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
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

  v_total := GREATEST(v_subtotal - GREATEST(COALESCE(p_discount_paisa,0),0), 0);

  UPDATE public.sales SET
    subtotal_paisa = v_subtotal,
    discount_paisa = GREATEST(COALESCE(p_discount_paisa,0),0),
    total_paisa = v_total,
    paid_paisa = GREATEST(COALESCE(p_paid_paisa,0),0),
    change_paisa = GREATEST(GREATEST(COALESCE(p_paid_paisa,0),0) - v_total, 0),
    cost_paisa = v_cost,
    profit_paisa = v_total - v_cost
  WHERE id = v_sale_id;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, description, changes)
  VALUES (v_uid, 'create', 'sale', v_sale_id, 'Sale ' || v_invoice || ' completed',
    jsonb_build_object('total_paisa', v_total, 'items', jsonb_array_length(p_items)));

  RETURN jsonb_build_object('sale_id', v_sale_id, 'invoice_no', v_invoice, 'duplicate', false);
END; $$;

CREATE OR REPLACE FUNCTION public.create_purchase(
  p_items jsonb,
  p_supplier_id uuid DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_purchase_date date DEFAULT current_date,
  p_discount_paisa bigint DEFAULT 0,
  p_paid_paisa bigint DEFAULT 0,
  p_note text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_purchase_id uuid;
  v_item jsonb;
  v_product public.products%ROWTYPE;
  v_batch_id uuid;
  v_qty int;
  v_cost bigint;
  v_subtotal bigint := 0;
  v_batch_no text;
  v_expiry date;
  v_existing_qty int;
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'manager')) THEN
    RAISE EXCEPTION 'You are not allowed to record purchases.';
  END IF;
  IF jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Add at least one medicine to the purchase.'; END IF;

  INSERT INTO public.purchases (supplier_id, reference, purchase_date, note, user_id)
  VALUES (p_supplier_id, p_reference, COALESCE(p_purchase_date, current_date), p_note, v_uid)
  RETURNING id INTO v_purchase_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'product_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'One of the medicines no longer exists.'; END IF;

    v_qty := COALESCE((v_item->>'quantity_base')::int, 0);
    IF v_qty <= 0 THEN RAISE EXCEPTION 'Quantity for % must be greater than zero.', v_product.brand_name; END IF;
    v_cost := GREATEST(COALESCE((v_item->>'cost_price_paisa')::bigint, 0), 0);
    v_batch_no := COALESCE(NULLIF(v_item->>'batch_number',''), 'AUTO-' || to_char(now(),'YYMMDDHH24MISS'));
    v_expiry := NULLIF(v_item->>'expiry_date','')::date;

    SELECT id, quantity_base INTO v_batch_id, v_existing_qty FROM public.product_batches
      WHERE product_id = v_product.id AND batch_number = v_batch_no FOR UPDATE;

    IF v_batch_id IS NULL THEN
      INSERT INTO public.product_batches (product_id, batch_number, expiry_date, cost_price_paisa, quantity_base, initial_quantity_base, supplier_id)
      VALUES (v_product.id, v_batch_no, v_expiry, v_cost, v_qty, v_qty, p_supplier_id)
      RETURNING id INTO v_batch_id;
      v_existing_qty := 0;
    ELSE
      UPDATE public.product_batches SET quantity_base = quantity_base + v_qty,
        cost_price_paisa = v_cost,
        expiry_date = COALESCE(v_expiry, expiry_date),
        initial_quantity_base = initial_quantity_base + v_qty
      WHERE id = v_batch_id;
    END IF;

    IF (v_item->>'sale_price_paisa') IS NOT NULL THEN
      UPDATE public.products SET sale_price_paisa = (v_item->>'sale_price_paisa')::bigint, cost_price_paisa = v_cost, updated_at = now()
      WHERE id = v_product.id;
    ELSE
      UPDATE public.products SET cost_price_paisa = v_cost, updated_at = now() WHERE id = v_product.id;
    END IF;

    INSERT INTO public.purchase_items (purchase_id, product_id, batch_id, product_name, batch_number, expiry_date, quantity_base, cost_price_paisa, line_total_paisa)
    VALUES (v_purchase_id, v_product.id, v_batch_id, v_product.brand_name || COALESCE(' ' || v_product.strength,''), v_batch_no, v_expiry, v_qty, v_cost, v_cost * v_qty);

    INSERT INTO public.stock_movements (product_id, batch_id, change_base, balance_after, reason, reference_type, reference_id, user_id, note)
    VALUES (v_product.id, v_batch_id, v_qty, v_existing_qty + v_qty, 'purchase', 'purchase', v_purchase_id, v_uid, v_batch_no);

    v_subtotal := v_subtotal + v_cost * v_qty;
  END LOOP;

  UPDATE public.purchases SET subtotal_paisa = v_subtotal,
    discount_paisa = GREATEST(COALESCE(p_discount_paisa,0),0),
    total_paisa = GREATEST(v_subtotal - GREATEST(COALESCE(p_discount_paisa,0),0),0),
    paid_paisa = GREATEST(COALESCE(p_paid_paisa,0),0)
  WHERE id = v_purchase_id;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, description, changes)
  VALUES (v_uid, 'create', 'purchase', v_purchase_id, 'Purchase recorded', jsonb_build_object('total_paisa', v_subtotal));

  RETURN jsonb_build_object('purchase_id', v_purchase_id);
END; $$;

CREATE OR REPLACE FUNCTION public.create_sale_return(
  p_sale_id uuid,
  p_items jsonb,
  p_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_return_id uuid;
  v_return_no text;
  v_item jsonb;
  v_si public.sale_items%ROWTYPE;
  v_qty int;
  v_refund bigint;
  v_total bigint := 0;
  v_bal int;
BEGIN
  IF v_uid IS NULL OR NOT public.is_staff(v_uid) THEN RAISE EXCEPTION 'You are not allowed to record returns.'; END IF;
  IF jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Select at least one item to return.'; END IF;

  v_return_no := 'RET-' || nextval('public.return_seq')::text;
  INSERT INTO public.sale_returns (return_no, sale_id, reason, user_id)
  VALUES (v_return_no, p_sale_id, p_reason, v_uid) RETURNING id INTO v_return_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_si FROM public.sale_items WHERE id = (v_item->>'sale_item_id')::uuid AND sale_id = p_sale_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'This item does not belong to the selected invoice.'; END IF;

    v_qty := COALESCE((v_item->>'quantity_base')::int, 0);
    IF v_qty <= 0 THEN CONTINUE; END IF;
    IF v_qty > v_si.quantity_base - v_si.returned_base THEN
      RAISE EXCEPTION 'Only % units of % can still be returned.', v_si.quantity_base - v_si.returned_base, v_si.product_name;
    END IF;

    v_refund := ROUND(v_si.line_total_paisa::numeric * v_qty / v_si.quantity_base);
    v_total := v_total + v_refund;

    UPDATE public.sale_items SET returned_base = returned_base + v_qty WHERE id = v_si.id;

    IF v_si.batch_id IS NOT NULL THEN
      UPDATE public.product_batches SET quantity_base = quantity_base + v_qty WHERE id = v_si.batch_id
      RETURNING quantity_base INTO v_bal;
    END IF;

    INSERT INTO public.return_items (return_id, sale_item_id, product_id, product_name, quantity_base, refund_paisa)
    VALUES (v_return_id, v_si.id, v_si.product_id, v_si.product_name, v_qty, v_refund);

    INSERT INTO public.stock_movements (product_id, batch_id, change_base, balance_after, reason, reference_type, reference_id, user_id, note)
    VALUES (v_si.product_id, v_si.batch_id, v_qty, v_bal, 'sale_return', 'sale_return', v_return_id, v_uid, v_return_no);
  END LOOP;

  UPDATE public.sale_returns SET total_paisa = v_total WHERE id = v_return_id;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, description, changes)
  VALUES (v_uid, 'create', 'sale_return', v_return_id, 'Return ' || v_return_no || ' recorded', jsonb_build_object('refund_paisa', v_total));

  RETURN jsonb_build_object('return_id', v_return_id, 'return_no', v_return_no, 'refund_paisa', v_total);
END; $$;

CREATE OR REPLACE FUNCTION public.adjust_stock(
  p_batch_id uuid,
  p_change int,
  p_reason public.movement_reason,
  p_note text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_batch public.product_batches%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'manager')) THEN
    RAISE EXCEPTION 'You are not allowed to adjust stock.';
  END IF;
  SELECT * INTO v_batch FROM public.product_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Batch not found.'; END IF;
  IF v_batch.quantity_base + p_change < 0 THEN RAISE EXCEPTION 'Stock cannot go below zero. Only % units available.', v_batch.quantity_base; END IF;
  UPDATE public.product_batches SET quantity_base = quantity_base + p_change WHERE id = p_batch_id;
  INSERT INTO public.stock_movements (product_id, batch_id, change_base, balance_after, reason, reference_type, user_id, note)
  VALUES (v_batch.product_id, p_batch_id, p_change, v_batch.quantity_base + p_change, p_reason, 'adjustment', v_uid, p_note);
  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, description)
  VALUES (v_uid, 'adjust', 'stock', p_batch_id, 'Stock adjusted by ' || p_change);
  RETURN jsonb_build_object('ok', true);
END; $$;

-- Aggregated product stock view
CREATE OR REPLACE VIEW public.product_stock
WITH (security_invoker = true) AS
SELECT p.id AS product_id,
  COALESCE(SUM(b.quantity_base), 0)::int AS stock_base,
  COALESCE(SUM(CASE WHEN b.expiry_date IS NULL OR b.expiry_date >= current_date THEN b.quantity_base ELSE 0 END),0)::int AS sellable_base,
  COALESCE(SUM(b.quantity_base * b.cost_price_paisa), 0)::bigint AS stock_value_paisa,
  MIN(b.expiry_date) FILTER (WHERE b.quantity_base > 0) AS nearest_expiry
FROM public.products p
LEFT JOIN public.product_batches b ON b.product_id = p.id
GROUP BY p.id;
GRANT SELECT ON public.product_stock TO authenticated;
