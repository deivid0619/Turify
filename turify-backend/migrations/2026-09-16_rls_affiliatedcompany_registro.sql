-- ============================================================================
-- Turify — RLS de AffiliatedCompany para permitir que un conductor registre
-- su propia empresa si no está en la lista fija (Departour / Transporte Real)
-- ----------------------------------------------------------------------------
-- La migración 2026-09-06_rls_politicas.sql dejó el INSERT de esta tabla
-- restringido solo a ADMIN, con el comentario explícito "No hay endpoint que
-- la modifique desde la API... por si se administra a mano". Ahora sí hay uno:
-- POST /drivers/register-details permite escribir nombre+NIT cuando la
-- empresa del conductor no está en la lista, y hace un find-or-create por NIT
-- (único) contra esta tabla — necesita poder insertar como DRIVER, no solo
-- como ADMIN.
-- ============================================================================

DROP POLICY IF EXISTS affiliatedcompany_insert ON "AffiliatedCompany";
CREATE POLICY affiliatedcompany_insert ON "AffiliatedCompany"
  FOR INSERT
  WITH CHECK (app_current_role() IN ('ADMIN', 'DRIVER'));
