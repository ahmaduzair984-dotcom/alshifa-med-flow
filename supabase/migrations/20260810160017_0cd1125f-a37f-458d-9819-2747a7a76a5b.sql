
REVOKE EXECUTE ON FUNCTION public.create_sale(jsonb,uuid,bigint,bigint,text,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_purchase(jsonb,uuid,text,date,bigint,bigint,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_sale_return(uuid,jsonb,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.adjust_stock(uuid,int,public.movement_reason,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM anon;
