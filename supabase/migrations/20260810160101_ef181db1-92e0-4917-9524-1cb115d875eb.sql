
INSERT INTO public.categories (name) VALUES
 ('Analgesic'),('Antibiotic'),('Antihistamine'),('Antacid'),('Syrup'),('Vitamin'),('Injection')
ON CONFLICT DO NOTHING;

INSERT INTO public.suppliers (name, company, contact_person, phone, address) VALUES
 ('Al Rehman Pharma', 'Al Rehman Distributors', 'Kashif Ali', '0300-1234567', 'Main Bazar, Gujranwala'),
 ('Shifa Medicos', 'Shifa Medicos Pvt Ltd', 'Bilal Ahmed', '0321-7654321', 'Satellite Town, Gujranwala')
ON CONFLICT DO NOTHING;

WITH cat AS (SELECT name, id FROM public.categories),
 sup AS (SELECT id FROM public.suppliers ORDER BY created_at LIMIT 1),
 ins AS (
  INSERT INTO public.products (brand_name, generic_name, category_id, strength, dosage_form, manufacturer, base_unit, pack_unit, units_per_pack, carton_unit, packs_per_carton, sale_price_paisa, cost_price_paisa, min_stock, prescription_required, notes)
  VALUES
   ('Panadol','Paracetamol',(SELECT id FROM cat WHERE name='Analgesic'),'500mg','Tablet','GSK','Tablet','Strip',10,'Box',10,22000,18000,50,false,'Demo data'),
   ('Panadol Extra','Paracetamol + Caffeine',(SELECT id FROM cat WHERE name='Analgesic'),'500mg','Tablet','GSK','Tablet','Strip',10,'Box',10,28000,23000,40,false,'Demo data'),
   ('Brufen','Ibuprofen',(SELECT id FROM cat WHERE name='Analgesic'),'400mg','Tablet','Abbott','Tablet','Strip',10,'Box',10,35000,28000,30,false,'Demo data'),
   ('Cetrizine','Cetirizine',(SELECT id FROM cat WHERE name='Antihistamine'),'10mg','Tablet','Sami','Tablet','Strip',10,'Box',10,12000,8500,30,false,'Demo data'),
   ('Augmentin','Amoxicillin + Clavulanate',(SELECT id FROM cat WHERE name='Antibiotic'),'625mg','Tablet','GSK','Tablet','Strip',6,'Box',10,95000,78000,20,true,'Demo data'),
   ('Calpol Syrup','Paracetamol',(SELECT id FROM cat WHERE name='Syrup'),'120mg/5ml','Syrup','GSK','Bottle',NULL,1,NULL,1,15000,11500,10,false,'Demo data'),
   ('Risek','Omeprazole',(SELECT id FROM cat WHERE name='Antacid'),'20mg','Capsule','Getz','Capsule','Strip',14,'Box',10,42000,34000,20,false,'Demo data'),
   ('Neurobion','Vitamin B Complex',(SELECT id FROM cat WHERE name='Vitamin'),'—','Injection','Merck','Ampoule',NULL,1,NULL,1,18000,14000,15,true,'Demo data')
  RETURNING id, brand_name, cost_price_paisa
 ),
 b AS (
  INSERT INTO public.product_batches (product_id, batch_number, expiry_date, cost_price_paisa, quantity_base, initial_quantity_base, supplier_id)
  SELECT ins.id,
    upper(left(regexp_replace(ins.brand_name,'[^A-Za-z]','','g'),3)) || '001',
    (current_date + (interval '1 day' * (180 + (row_number() over ())::int * 60)))::date,
    ins.cost_price_paisa,
    CASE WHEN ins.brand_name IN ('Calpol Syrup','Neurobion') THEN 40 ELSE 200 END,
    CASE WHEN ins.brand_name IN ('Calpol Syrup','Neurobion') THEN 40 ELSE 200 END,
    (SELECT id FROM sup)
  FROM ins
  RETURNING id, product_id, quantity_base
 )
INSERT INTO public.stock_movements (product_id, batch_id, change_base, balance_after, reason, reference_type, note)
SELECT b.product_id, b.id, b.quantity_base, b.quantity_base, 'opening', 'seed', 'Demo opening stock' FROM b;
