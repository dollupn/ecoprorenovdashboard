-- Créer la fonction de synchronisation automatique site ↔ projet
CREATE OR REPLACE FUNCTION sync_site_status_from_project()
RETURNS TRIGGER AS $$
BEGIN
  -- Si le statut du projet indique qu'il est terminé
  IF NEW.status IN ('CHANTIER_TERMINE', 'LIVRE', 'FACTURE_ENVOYEE', 'AH', 'AAF', 'CLOTURE') THEN
    -- Mettre à jour tous les sites liés à ce projet
    UPDATE sites
    SET 
      status = 'TERMINE',
      date_fin = COALESCE(date_fin, CURRENT_DATE),
      revenue = COALESCE(NULLIF(revenue, 0), ca_ttc, 0),
      updated_at = now()
    WHERE project_id = NEW.id
      AND status != 'TERMINE';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Créer le trigger sur la table projects
DROP TRIGGER IF EXISTS trigger_sync_site_status_from_project ON projects;
CREATE TRIGGER trigger_sync_site_status_from_project
  AFTER INSERT OR UPDATE OF status ON projects
  FOR EACH ROW
  EXECUTE FUNCTION sync_site_status_from_project();

-- Mettre à jour les sites existants dont le projet est terminé
UPDATE sites s
SET 
  status = 'TERMINE',
  date_fin = COALESCE(s.date_fin, CURRENT_DATE),
  revenue = COALESCE(NULLIF(s.revenue, 0), s.ca_ttc, 0),
  updated_at = now()
FROM projects p
WHERE s.project_id = p.id
  AND p.status IN ('CHANTIER_TERMINE', 'LIVRE', 'FACTURE_ENVOYEE', 'AH', 'AAF', 'CLOTURE')
  AND s.status != 'TERMINE';