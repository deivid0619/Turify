-- ============================================================================
-- Turify — RLS de PriceHistory para ÉPICA 12 (motor de precio sugerido, HU29)
-- ----------------------------------------------------------------------------
-- La migración 2026-09-06_rls_politicas.sql dejó "PriceHistory" restringida a
-- solo ADMIN a propósito, como placeholder seguro ("ninguna de las dos [tabla]
-- tiene todavía un endpoint que las use... se dejan restringidas solo a ADMIN
-- como placeholder seguro, para revisar cuando se implementen"). Esta es esa
-- revisión, ahora que SCRUM-222 sí la usa:
--
--   * INSERT: lo dispara el backend automáticamente cuando un viaje se marca
--     COMPLETED (ver app/pricing/service.py::registrar_resultado_viaje,
--     llamado desde PATCH /api/service-requests/{id}/complete), en una
--     sesión cuyo rol real es el del conductor que finaliza el viaje — nunca
--     ADMIN. Se permite a cualquier usuario autenticado: la fila no contiene
--     ningún dato personal (no hay user_id en PriceHistory), solo agregados
--     de precio/distancia/vehículo.
--   * SELECT/UPDATE/DELETE: se mantienen restringidos a ADMIN. Para entrenar
--     el modelo de ML sobre el historial completo (sin importar qué usuario
--     disparó la solicitud que terminó necesitando un precio), el backend
--     abre una sesión aparte con el rol elevado a ADMIN
--     (app/pricing/service.py::_sesion_admin_temporal) SOLO para esa lectura
--     interna de solo lectura — nunca a partir de un rol que vino del cliente.
--
-- Correr esto igual que las migraciones anteriores: primero contra la base
-- LOCAL de Docker, y solo después de probar el flujo completo (publicar
-- viaje -> ver precio sugerido -> completar viaje) contra Supabase.
-- ============================================================================

DROP POLICY IF EXISTS pricehistory_admin_only ON "PriceHistory";

CREATE POLICY pricehistory_admin_all ON "PriceHistory"
  FOR ALL
  USING (app_current_role() = 'ADMIN')
  WITH CHECK (app_current_role() = 'ADMIN');

CREATE POLICY pricehistory_insert_autenticado ON "PriceHistory"
  FOR INSERT
  WITH CHECK (app_current_role() IS NOT NULL);
