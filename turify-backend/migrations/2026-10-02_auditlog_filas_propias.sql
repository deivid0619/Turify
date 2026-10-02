-- Cada usuario puede leer sus propias filas de AuditLog.
--
-- El backend de producción entra como turify_app, que respeta RLS. La
-- política de lectura de AuditLog solo dejaba ver filas al admin, y eso
-- rompía dos cosas:
--   1. GET /users/me/autorizacion-datos no encontraba la autorización del
--      propio usuario: el aviso de la política salía siempre.
--   2. El INSERT ... RETURNING que hace SQLAlchemy exige poder leer la fila
--      recién insertada, así que guardar la autorización fallaba con
--      "new row violates row-level security policy".
--
-- Las filas de otros usuarios siguen visibles solo para el admin.
-- Idempotente: se puede correr más de una vez.

DROP POLICY IF EXISTS auditlog_select_propio ON "AuditLog";
CREATE POLICY auditlog_select_propio ON "AuditLog"
    FOR SELECT
    USING (user_id = app_current_user_id());
