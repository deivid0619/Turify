-- ============================================================================
-- Turify — precio fijo (aceptar el precio sugerido en vez de negociar)
-- ----------------------------------------------------------------------------
-- Hasta ahora "Confirmar y Publicar Viaje" (usar el precio sugerido) y
-- "Prefiero no usar el precio sugerido — negociar" hacían exactamente lo
-- mismo: publicar un viaje PENDING abierto a que cualquier conductor
-- ofertara cualquier precio. El precio sugerido nunca era vinculante.
--
-- precio_fijo distingue los dos caminos: si es TRUE, el conductor no puede
-- ofertar un precio distinto (POST /{id}/offers lo rechaza) — solo puede
-- aceptar el viaje al precio ya fijado (POST /{id}/accept-fixed-price), lo
-- que salta directo a ASSIGNED sin la ronda de oferta/contraoferta.
-- ============================================================================

ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS precio_fijo BOOLEAN DEFAULT FALSE;
