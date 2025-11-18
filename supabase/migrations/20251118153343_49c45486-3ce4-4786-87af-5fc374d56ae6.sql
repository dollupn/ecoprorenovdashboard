-- Add option to use surface_posee instead of surface_facturee for MO calculation in isolation projects
ALTER TABLE sites 
ADD COLUMN use_surface_posee_for_mo boolean DEFAULT false;

COMMENT ON COLUMN sites.use_surface_posee_for_mo IS 'If true, use surface_posee_m2 for MO calculation instead of surface_facturee_m2 (isolation projects only)';
