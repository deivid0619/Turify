-- ============================================================================
-- Turify — cédula del conductor por ambos lados (SCRUM-252)
-- ----------------------------------------------------------------------------
-- El registro de conductor pedía SOAT, licencia, tarjeta de operación,
-- tecnomecánica y seguros, pero no la cédula — aunque /politicas (sección
-- 2.1) ya decía que Turify recoge el documento de identidad del conductor.
-- Se agregan dos tipos de documento al enum para que la cédula siga el mismo
-- flujo de revisión del admin que los demás.
--
-- IMPORTANTE: aplicar ANTES de desplegar el código que la usa; si no, el
-- registro de conductor falla al guardar un tipo de documento que no existe.
-- ============================================================================

ALTER TYPE doc_type ADD VALUE IF NOT EXISTS 'Cedula frente';
ALTER TYPE doc_type ADD VALUE IF NOT EXISTS 'Cedula reverso';
