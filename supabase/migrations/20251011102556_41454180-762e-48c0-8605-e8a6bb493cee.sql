-- Fix function search_path for security
-- Update calculate_price_ttc function (avec CASCADE)
DROP FUNCTION IF EXISTS public.calculate_price_ttc() CASCADE;
CREATE OR REPLACE FUNCTION public.calculate_price_ttc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.base_price_ht IS NOT NULL AND NEW.tva_percentage IS NOT NULL THEN
    NEW.price_ttc := NEW.base_price_ht * (1 + NEW.tva_percentage / 100);
  ELSE
    NEW.price_ttc := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

-- Recreate the trigger
CREATE TRIGGER calculate_price_ttc_trigger
BEFORE INSERT OR UPDATE ON public.product_catalog
FOR EACH ROW
EXECUTE FUNCTION public.calculate_price_ttc();