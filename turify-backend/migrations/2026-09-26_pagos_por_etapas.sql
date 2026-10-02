-- ============================================================================
-- Turify — ÉPICA 6: pagos por etapas, código de abordaje y bitácora (SCRUM-178)
-- ----------------------------------------------------------------------------
-- Recorrido del dinero acordado con David el 25 sep 2026:
--
--   Ida y vuelta: 20 % anticipo al confirmar · 50 % al llegar al destino ·
--                 30 % cuando los recoge para el regreso
--   Solo ida:     30 % anticipo al confirmar · 70 % al dejarlos en el destino
--
-- Mientras no esté Wompi (SCRUM-179) todo se le paga directo al conductor y
-- queda registrado con doble confirmación: quien recibe la plata es quien la
-- confirma.
--
--   * "ServiceRequest": etapa del viaje (tramo), código de abordaje de 4
--     dígitos con límite de intentos, y la hora de cada etapa (SCRUM-259).
--   * "PagoViaje": un pago del plan por cada etapa (SCRUM-258).
--   * "EventoViaje": bitácora del viaje. Solo se inserta: un trigger rechaza
--     UPDATE y DELETE, salvo los que llegan en cascada al borrar el viaje o el
--     usuario (SCRUM-260).
--   * "Reclamo": desacuerdos que resuelve un administrador (SCRUM-264).
--   * "CuentaPagoConductor": cuenta a nombre del conductor, verificada por un
--     administrador (SCRUM-263).
--
-- IMPORTANTE: aplicar ANTES de desplegar el código que la usa; si no, toda
-- consulta a "ServiceRequest" falla por las columnas nuevas. El backend crea
-- las tablas nuevas solo (create_all) si arranca primero, pero SIN las
-- políticas RLS ni el trigger: por eso esta migración es idempotente y se
-- puede correr antes o después, las veces que haga falta.
--
-- Requiere 2026-09-06_rls_politicas.sql (funciones app_current_user_id(),
-- app_current_role() y rls_*).
-- ============================================================================


-- ── 1. Etapas del viaje en "ServiceRequest" ─────────────────────────────────

ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS tramo VARCHAR(12);
ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS codigo_abordaje VARCHAR(4);
ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS codigo_intentos INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS codigo_bloqueado_hasta TIMESTAMPTZ;
ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS abordo_at TIMESTAMPTZ;
ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS llego_destino_at TIMESTAMPTZ;
ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS abordo_regreso_at TIMESTAMPTZ;
ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS finalizado_at TIMESTAMPTZ;
ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS cerrado_sin_regreso BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS motivo_sin_regreso TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_sr_tramo') THEN
    ALTER TABLE "ServiceRequest" ADD CONSTRAINT ck_sr_tramo
      CHECK (tramo IS NULL OR tramo IN ('IDA', 'EN_DESTINO', 'REGRESO'));
  END IF;
END $$;


-- ── 2. Tablas nuevas ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "PagoViaje" (
  pago_id        SERIAL PRIMARY KEY,
  request_id     INTEGER NOT NULL REFERENCES "ServiceRequest"(request_id) ON DELETE CASCADE,
  offer_id       INTEGER NOT NULL REFERENCES "DriverOffer"(offer_id) ON DELETE CASCADE,
  driver_id      INTEGER NOT NULL REFERENCES "User"(user_id) ON DELETE CASCADE,
  hito           VARCHAR(20) NOT NULL,
  orden          INTEGER NOT NULL,
  porcentaje     NUMERIC(5, 2) NOT NULL,
  monto          NUMERIC(12, 2) NOT NULL,
  comision       NUMERIC(12, 2) NOT NULL DEFAULT 0,
  canal          VARCHAR(10) NOT NULL DEFAULT 'DIRECTO',
  estado         VARCHAR(25) NOT NULL DEFAULT 'PENDIENTE',
  estado_previo  VARCHAR(25),
  exigible_desde TIMESTAMPTZ,
  reportado_at   TIMESTAMPTZ,
  confirmado_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT ck_pago_hito CHECK (hito IN ('ANTICIPO', 'LLEGADA_DESTINO', 'RECOGIDA_REGRESO')),
  CONSTRAINT ck_pago_canal CHECK (canal IN ('DIRECTO', 'APP')),
  CONSTRAINT ck_pago_estado CHECK (estado IN (
    'PENDIENTE', 'PAGO_REPORTADO', 'CONFIRMADO', 'EN_RECLAMO',
    'DEVOLUCION_PENDIENTE', 'DEVOLUCION_REPORTADA', 'DEVUELTO', 'ANULADO',
    'RETENIDO', 'LIBERADO', 'REEMBOLSADO')),
  CONSTRAINT ck_pago_montos CHECK (monto >= 0 AND comision >= 0 AND comision <= monto),
  CONSTRAINT uq_pago_oferta_hito UNIQUE (offer_id, hito)
);
CREATE INDEX IF NOT EXISTS "ix_PagoViaje_request_id" ON "PagoViaje"(request_id);
CREATE INDEX IF NOT EXISTS "ix_PagoViaje_driver_id" ON "PagoViaje"(driver_id);

CREATE TABLE IF NOT EXISTS "EventoViaje" (
  evento_id  SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES "ServiceRequest"(request_id) ON DELETE CASCADE,
  pago_id    INTEGER REFERENCES "PagoViaje"(pago_id) ON DELETE CASCADE,
  tipo       VARCHAR(40) NOT NULL,
  actor_id   INTEGER REFERENCES "User"(user_id) ON DELETE SET NULL,
  monto      NUMERIC(12, 2),
  lat        NUMERIC(10, 8),
  lng        NUMERIC(11, 8),
  detalle    TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ix_EventoViaje_request_id" ON "EventoViaje"(request_id);

CREATE TABLE IF NOT EXISTS "Reclamo" (
  reclamo_id   SERIAL PRIMARY KEY,
  request_id   INTEGER NOT NULL REFERENCES "ServiceRequest"(request_id) ON DELETE CASCADE,
  pago_id      INTEGER REFERENCES "PagoViaje"(pago_id) ON DELETE CASCADE,
  abierto_por  INTEGER REFERENCES "User"(user_id) ON DELETE SET NULL,
  motivo       TEXT NOT NULL,
  estado       VARCHAR(10) NOT NULL DEFAULT 'ABIERTO',
  decision     VARCHAR(30),
  resolucion   TEXT,
  resuelto_por INTEGER REFERENCES "User"(user_id) ON DELETE SET NULL,
  resuelto_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT ck_reclamo_estado CHECK (estado IN ('ABIERTO', 'RESUELTO'))
);
CREATE INDEX IF NOT EXISTS "ix_Reclamo_request_id" ON "Reclamo"(request_id);

CREATE TABLE IF NOT EXISTS "CuentaPagoConductor" (
  cuenta_id         SERIAL PRIMARY KEY,
  driver_id         INTEGER NOT NULL UNIQUE REFERENCES "User"(user_id) ON DELETE CASCADE,
  tipo              VARCHAR(25) NOT NULL,
  banco             VARCHAR(60),
  numero            VARCHAR(20) NOT NULL,
  titular_nombre    VARCHAR(100) NOT NULL,
  titular_documento VARCHAR(10) NOT NULL,
  estado            VARCHAR(25) NOT NULL DEFAULT 'PENDIENTE_VERIFICACION',
  nota_admin        TEXT,
  verificada_por    INTEGER REFERENCES "User"(user_id) ON DELETE SET NULL,
  verificada_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT ck_cuenta_tipo CHECK (tipo IN ('NEQUI', 'DAVIPLATA', 'BANCOLOMBIA_AHORROS', 'BANCOLOMBIA_CORRIENTE', 'OTRO_BANCO')),
  CONSTRAINT ck_cuenta_estado CHECK (estado IN ('PENDIENTE_VERIFICACION', 'VERIFICADA', 'RECHAZADA')),
  CONSTRAINT ck_cuenta_numero CHECK (numero ~ '^[0-9]{6,20}$'),
  CONSTRAINT ck_cuenta_documento CHECK (titular_documento ~ '^[0-9]{5,10}$')
);


-- ── 3. La bitácora solo admite inserciones ───────────────────────────────────
-- pg_trigger_depth() > 1 = la fila llega en cascada desde otro trigger (se
-- borró el viaje o el usuario, o se anuló el actor). Un UPDATE o DELETE
-- directo, venga de donde venga, se rechaza.

CREATE OR REPLACE FUNCTION evento_viaje_solo_insercion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'La bitácora del viaje (EventoViaje) solo admite inserciones: no se puede hacer %.', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS evento_viaje_solo_insercion ON "EventoViaje";
CREATE TRIGGER evento_viaje_solo_insercion
  BEFORE UPDATE OR DELETE ON "EventoViaje"
  FOR EACH ROW EXECUTE FUNCTION evento_viaje_solo_insercion();


-- ── 4. RLS ───────────────────────────────────────────────────────────────────
-- Mismo modelo que 2026-09-06_rls_politicas.sql: el backend fija
-- app.current_user_id / app.current_user_role en cada request. Ninguna
-- política deja pasar una sesión sin usuario (la API de datos de Supabase con
-- la llave anon no ve nada de esto).

ALTER TABLE "PagoViaje"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EventoViaje"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Reclamo"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CuentaPagoConductor" ENABLE ROW LEVEL SECURITY;

-- PagoViaje: el pasajero dueño del viaje, el conductor del pago y el admin.
-- driver_id va en la fila para que el conductor que canceló siga viendo el
-- anticipo que tiene que devolver aunque su oferta ya no esté ACCEPTED.
DROP POLICY IF EXISTS pagoviaje_select ON "PagoViaje";
CREATE POLICY pagoviaje_select ON "PagoViaje"
  FOR SELECT
  USING (
    app_current_role() = 'ADMIN'
    OR driver_id = app_current_user_id()
    OR rls_es_dueno_del_viaje(app_current_user_id(), request_id)
  );

DROP POLICY IF EXISTS pagoviaje_insert ON "PagoViaje";
CREATE POLICY pagoviaje_insert ON "PagoViaje"
  FOR INSERT
  WITH CHECK (
    app_current_role() = 'ADMIN'
    OR driver_id = app_current_user_id()
    OR rls_es_dueno_del_viaje(app_current_user_id(), request_id)
  );

DROP POLICY IF EXISTS pagoviaje_update ON "PagoViaje";
CREATE POLICY pagoviaje_update ON "PagoViaje"
  FOR UPDATE
  USING (
    app_current_role() = 'ADMIN'
    OR driver_id = app_current_user_id()
    OR rls_es_dueno_del_viaje(app_current_user_id(), request_id)
  )
  WITH CHECK (
    app_current_role() = 'ADMIN'
    OR driver_id = app_current_user_id()
    OR rls_es_dueno_del_viaje(app_current_user_id(), request_id)
  );
-- Sin política de DELETE: los pagos no se borran, se anulan.

-- EventoViaje y Reclamo: el pasajero, cualquier conductor que haya ofertado
-- en el viaje (incluido el que canceló) y el admin.
DROP POLICY IF EXISTS eventoviaje_select ON "EventoViaje";
CREATE POLICY eventoviaje_select ON "EventoViaje"
  FOR SELECT
  USING (
    app_current_role() = 'ADMIN'
    OR rls_es_dueno_del_viaje(app_current_user_id(), request_id)
    OR rls_conductor_tiene_oferta(app_current_user_id(), request_id)
  );

DROP POLICY IF EXISTS eventoviaje_insert ON "EventoViaje";
CREATE POLICY eventoviaje_insert ON "EventoViaje"
  FOR INSERT
  WITH CHECK (
    app_current_role() = 'ADMIN'
    OR rls_es_dueno_del_viaje(app_current_user_id(), request_id)
    OR rls_conductor_tiene_oferta(app_current_user_id(), request_id)
  );

DROP POLICY IF EXISTS reclamo_select ON "Reclamo";
CREATE POLICY reclamo_select ON "Reclamo"
  FOR SELECT
  USING (
    app_current_role() = 'ADMIN'
    OR rls_es_dueno_del_viaje(app_current_user_id(), request_id)
    OR rls_conductor_tiene_oferta(app_current_user_id(), request_id)
  );

DROP POLICY IF EXISTS reclamo_insert ON "Reclamo";
CREATE POLICY reclamo_insert ON "Reclamo"
  FOR INSERT
  WITH CHECK (
    app_current_role() = 'ADMIN'
    OR rls_es_dueno_del_viaje(app_current_user_id(), request_id)
    OR rls_conductor_tiene_oferta(app_current_user_id(), request_id)
  );

-- Resolver un reclamo es cosa del administrador.
DROP POLICY IF EXISTS reclamo_update ON "Reclamo";
CREATE POLICY reclamo_update ON "Reclamo"
  FOR UPDATE
  USING (app_current_role() = 'ADMIN')
  WITH CHECK (app_current_role() = 'ADMIN');

-- CuentaPagoConductor: el conductor dueño, el admin, y el pasajero que tiene
-- un viaje confirmado con ese conductor (para saber a dónde pagarle).
DROP POLICY IF EXISTS cuentapago_select ON "CuentaPagoConductor";
CREATE POLICY cuentapago_select ON "CuentaPagoConductor"
  FOR SELECT
  USING (
    app_current_role() = 'ADMIN'
    OR driver_id = app_current_user_id()
    OR rls_conectados_por_oferta_aceptada(app_current_user_id(), driver_id)
  );

DROP POLICY IF EXISTS cuentapago_insert ON "CuentaPagoConductor";
CREATE POLICY cuentapago_insert ON "CuentaPagoConductor"
  FOR INSERT
  WITH CHECK (driver_id = app_current_user_id());

DROP POLICY IF EXISTS cuentapago_update ON "CuentaPagoConductor";
CREATE POLICY cuentapago_update ON "CuentaPagoConductor"
  FOR UPDATE
  USING (app_current_role() = 'ADMIN' OR driver_id = app_current_user_id())
  WITH CHECK (app_current_role() = 'ADMIN' OR driver_id = app_current_user_id());


-- ── 5. Permisos por rol ──────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'turify_app') THEN
    GRANT SELECT, INSERT, UPDATE ON "PagoViaje", "Reclamo", "CuentaPagoConductor" TO turify_app;
    GRANT SELECT, INSERT ON "EventoViaje" TO turify_app;
    REVOKE UPDATE, DELETE ON "EventoViaje" FROM turify_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO turify_app;
  END IF;
  -- La app no lee estas tablas con el cliente de Supabase: se cierran del todo
  -- para las llaves públicas, además de RLS.
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "PagoViaje", "EventoViaje", "Reclamo", "CuentaPagoConductor" FROM anon;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "PagoViaje", "EventoViaje", "Reclamo", "CuentaPagoConductor" FROM authenticated;
  END IF;
END $$;
