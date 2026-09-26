-- ============================================================================
-- Turify — fotos reales del vehículo visibles para el pasajero (SCRUM-253)
-- ----------------------------------------------------------------------------
-- El vehículo tenía una sola foto (photo_url, del registro) que el pasajero
-- nunca veía. Ahora el conductor sube una foto por tipo (frente con la placa
-- visible, lateral, interior, maletero) y el pasajero las ve en la oferta y
-- en el perfil público del conductor, antes de aceptar.
--
-- Se guardan como JSONB en el mismo "Vehicle" (lista de {tipo, url,
-- subida}) en vez de una tabla aparte: así quedan cubiertas por las
-- políticas RLS que ya tiene "Vehicle" (vehicle_select / vehicle_update),
-- sin políticas nuevas.
--
-- IMPORTANTE: aplicar ANTES de desplegar el código que la usa; si no, toda
-- consulta a "Vehicle" falla por la columna que no existe.
-- ============================================================================

ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS fotos JSONB NOT NULL DEFAULT '[]'::jsonb;
