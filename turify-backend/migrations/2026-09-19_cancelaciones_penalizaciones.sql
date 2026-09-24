-- ============================================================================
-- Turify — HU59: política de cancelaciones y penalizaciones (SCRUM-211)
-- ----------------------------------------------------------------------------
-- Hasta ahora PATCH /{id}/cancel solo existía para que el pasajero abandonara
-- una búsqueda todavía PENDING (sin conductor asignado) — sin penalización,
-- porque nadie había comprometido nada todavía. No había forma de cancelar un
-- viaje ya ASSIGNED, ni de que el conductor cancelara el suyo.
--
-- Estas columnas registran CÓMO se canceló un viaje (quién, por qué, si fue
-- fuerza mayor con evidencia) y CUÁNTO le corresponde de penalización al
-- pasajero según la anticipación con la que canceló, sobre el precio ya
-- aceptado (DriverOffer.offered_price). Turify no cobra ese monto todavía
-- (no hay pasarela de pago integrada — Épica 6, HU34/35 siguen sin
-- implementar) — por ahora es el registro contractual/informativo de lo que
-- corresponde, igual que precio_fijo registra un precio vinculante sin que
-- Turify procese el cobro.
--
-- cancelaciones_injustificadas en User es la penalización a la calificación
-- del conductor que exige el criterio de aceptación ("conductor cancela sin
-- justificación: penalización en su calificación") — un contador aparte del
-- rating_avg de estrellas (Rating solo aplica a viajes COMPLETED; una
-- cancelación no es una experiencia de viaje calificable de esa forma).
--
-- No hace falta tocar RLS: "ServiceRequest" ya permite UPDATE al pasajero
-- dueño y al conductor con oferta ACCEPTED (política servicerequest_update),
-- y "User" ya permite a cada usuario actualizar su propia fila.
-- ============================================================================

ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS cancelled_by TEXT
  CHECK (cancelled_by IN ('PASSENGER', 'DRIVER'));
ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS is_force_majeure BOOLEAN DEFAULT FALSE;
ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS force_majeure_evidence_url TEXT;
ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS penalty_percentage NUMERIC(5,2);
ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS penalty_amount NUMERIC(10,2);
ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS cancelaciones_injustificadas INTEGER NOT NULL DEFAULT 0;
