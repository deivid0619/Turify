-- ============================================================================
-- Turify — FUEC real (lo expide la empresa afiliada, Turify solo lo recibe)
-- + representante del viaje entre los ocupantes
-- ----------------------------------------------------------------------------
-- Hasta ahora "registrar ocupantes" (TripPassenger) se documentaba como "el
-- FUEC", pero el FUEC en sí lo expide la empresa afiliada del conductor, no
-- Turify. Estas dos columnas separan las dos cosas: el archivo real (que
-- ahora es obligatorio para poder iniciar el viaje, junto con los
-- ocupantes) y cuál de los ocupantes es el representante del viaje.
--
-- No hace falta tocar RLS: "ServiceRequest" ya permite UPDATE al conductor
-- con oferta ACCEPTED (política servicerequest_update, usada hoy para pasar
-- el viaje a IN_PROGRESS/COMPLETED) y "TripPassenger" ya permite SELECT a
-- ese mismo conductor (política trippassenger_select) — ambas cubren estas
-- columnas nuevas sin cambios.
-- ============================================================================

ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS fuec_url TEXT;

ALTER TABLE "TripPassenger" ADD COLUMN IF NOT EXISTS es_representante BOOLEAN DEFAULT FALSE;
