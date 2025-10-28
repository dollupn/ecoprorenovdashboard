-- Add prime_cee_total_cents column and keep legacy fields in sync
BEGIN;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS prime_cee_total_cents BIGINT;

-- Backfill from legacy numeric field when possible
UPDATE public.projects
SET prime_cee_total_cents = ROUND(prime_cee * 100)
WHERE prime_cee IS NOT NULL
  AND (prime_cee_total_cents IS NULL OR prime_cee_total_cents = 0);

CREATE OR REPLACE FUNCTION public.sync_project_prime_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  computed_cents BIGINT;
BEGIN
  IF NEW.prime_cee_total_cents IS NULL AND NEW.prime_cee IS NOT NULL THEN
    computed_cents := ROUND(NEW.prime_cee * 100);
    NEW.prime_cee_total_cents := computed_cents;
    NEW.prime_cee := computed_cents / 100.0;
  ELSIF NEW.prime_cee_total_cents IS NOT NULL THEN
    computed_cents := NEW.prime_cee_total_cents;
    NEW.prime_cee := computed_cents / 100.0;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_project_prime_totals_trigger ON public.projects;
CREATE TRIGGER sync_project_prime_totals_trigger
BEFORE INSERT OR UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.sync_project_prime_totals();

CREATE OR REPLACE FUNCTION public.auto_promote_project_to_livre()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target_project_id UUID;
  all_livre BOOLEAN;
BEGIN
  target_project_id := COALESCE(NEW.project_id, OLD.project_id);

  IF target_project_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COUNT(*) > 0 AND BOOL_AND(status = 'LIVRE')
  INTO all_livre
  FROM public.sites
  WHERE project_id = target_project_id;

  IF all_livre THEN
    UPDATE public.projects
    SET status = 'LIVRE'
    WHERE id = target_project_id
      AND status <> 'LIVRE';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS auto_promote_project_to_livre_insert ON public.sites;
DROP TRIGGER IF EXISTS auto_promote_project_to_livre_update ON public.sites;
DROP TRIGGER IF EXISTS auto_promote_project_to_livre_delete ON public.sites;

CREATE TRIGGER auto_promote_project_to_livre_insert
AFTER INSERT ON public.sites
FOR EACH ROW
EXECUTE FUNCTION public.auto_promote_project_to_livre();

CREATE TRIGGER auto_promote_project_to_livre_update
AFTER UPDATE ON public.sites
FOR EACH ROW
EXECUTE FUNCTION public.auto_promote_project_to_livre();

CREATE TRIGGER auto_promote_project_to_livre_delete
AFTER DELETE ON public.sites
FOR EACH ROW
EXECUTE FUNCTION public.auto_promote_project_to_livre();

COMMIT;
