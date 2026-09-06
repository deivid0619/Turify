-- ============================================================================
-- Turify — Políticas RLS (Row Level Security) en Postgres/Supabase
-- ----------------------------------------------------------------------------
-- HU seguridad (OWASP A01 — pérdida de control de acceso).
--
-- IMPORTANTE — lee esto antes de correr nada:
--
-- El backend hoy se conecta a la base con el usuario "postgres", que en
-- Supabase (y en cualquier Postgres) es efectivamente un superusuario: ESE
-- ROL SE SALTA CUALQUIER POLÍTICA RLS, sin importar qué tan bien escritas
-- estén. Si solo corrieras este script y siguieras conectando el backend
-- como "postgres", las políticas quedarían "bonitas" en el dashboard de
-- Supabase pero sin proteger nada real.
--
-- Por eso este script, además de las políticas, crea un rol nuevo y
-- restringido ("turify_app") sin privilegios de superusuario, pensado para
-- que el backend se conecte con ÉL en vez de con "postgres". El backend ya
-- fue modificado (ver app/security.py y app/database.py) para avisarle a
-- Postgres, en cada request autenticado, quién es el usuario actual
-- (mediante `SET LOCAL app.current_user_id` / `app.current_role`) — de eso
-- dependen las políticas de abajo.
--
-- PASOS PARA APLICAR ESTO (en este orden, y probando primero en local):
--   1. Corré este script completo contra tu base LOCAL de Docker (turify_db)
--      con un cliente conectado como "postgres" (DBeaver, psql, etc.).
--   2. Cambiá la contraseña del rol nuevo (ver el ALTER ROLE comentado más
--      abajo) por una clave real tuya — no dejes la de ejemplo.
--   3. En docker-compose.yml, cambiá TEMPORALMENTE la línea de
--      SQLALCHEMY_DATABASE_URL del backend para que use "turify_app" y su
--      clave en vez de "postgres", y reconstruí el backend.
--   4. Probá TODO el flujo de la app a mano (registro, login, crear viaje,
--      ofertar, aceptar/rechazar, subir documentos, verificar como admin,
--      notificaciones, perfil público de conductor, historial/recibo). Si
--      algo se rompe, avisame para ajustar la política correspondiente
--      ANTES de tocar producción.
--   5. Corré scripts/test_rls_acceso_cruzado.py contra la base local para
--      confirmar automáticamente que un usuario no puede ver datos de otro.
--   6. Solo cuando todo lo anterior quede validado en local: corré este
--      mismo script contra Supabase (SQL Editor -> New query -> Run), y
--      actualizá la variable SUPABASE_DB_URL de tu backend en Railway (o
--      donde esté desplegado) para que use "turify_app" en vez de
--      "postgres". No hace falta tocar el repo para ese cambio de producción.
--
-- Es idempotente: podés volver a correrlo sin duplicar nada.
-- ============================================================================


-- ── 1. Rol restringido para el backend ───────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'turify_app') THEN
    CREATE ROLE turify_app WITH
      LOGIN
      PASSWORD 'CAMBIA_ESTA_CLAVE_ANTES_DE_USARLA'
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOBYPASSRLS
      NOINHERIT;
  END IF;
END $$;

-- Cambiá la clave real acá (no dejes la de arriba) y guardala solo en tus
-- archivos .env / variables de entorno del backend, nunca en este archivo:
-- ALTER ROLE turify_app WITH PASSWORD 'tu-clave-real-aqui';

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO turify_app', current_database());
END $$;

GRANT USAGE ON SCHEMA public TO turify_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO turify_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO turify_app;

-- Para que las tablas/secuencias que se creen MÁS ADELANTE (nuevas
-- migraciones) también queden accesibles para este rol automáticamente.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO turify_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO turify_app;

-- Nota: turify_app NO tiene privilegio CREATE sobre el esquema, así que no
-- puede crear tablas nuevas — igual que hasta ahora, las migraciones de
-- esquema (tablas/columnas nuevas) se corren a mano en Supabase con el rol
-- "postgres", como ya venías haciendo con los archivos de migrations/.


-- ── 2. Habilitar RLS en las 5 tablas del alcance de esta HU ─────────────────
ALTER TABLE "User"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ServiceRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DriverOffer"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification"   ENABLE ROW LEVEL SECURITY;


-- ── 3. Tabla User ────────────────────────────────────────────────────────────
-- Cada quien ve su propio perfil completo. Además:
--   · sesión anónima (login/registro, antes de tener JWT) puede leer — es
--     imprescindible para poder verificar el email/contraseña al iniciar
--     sesión, ya que esta app no usa Supabase Auth sino su propio login.
--   · ADMIN ve todos.
--   · cualquier autenticado puede ver perfiles de rol DRIVER (son
--     semi-públicos por diseño: el pasajero elige conductor viendo su
--     perfil/calificación antes de aceptar una oferta).
--   · un conductor con una oferta ACCEPTED en un viaje puede ver al pasajero
--     de ese viaje (y viceversa ya está cubierto por la regla de DRIVER) —
--     lo necesita el historial/recibo del conductor.
DROP POLICY IF EXISTS user_select ON "User";
CREATE POLICY user_select ON "User"
  FOR SELECT
  USING (
    current_setting('app.current_user_id', true) IS NULL
    OR user_id = current_setting('app.current_user_id', true)::int
    OR current_setting('app.current_role', true) = 'ADMIN'
    OR role = 'DRIVER'
    OR EXISTS (
      SELECT 1 FROM "DriverOffer" do2
      JOIN "ServiceRequest" sr2 ON sr2.request_id = do2.request_id
      WHERE do2.status = 'ACCEPTED'
        AND current_setting('app.current_user_id', true)::int IN (sr2.passenger_id, do2.driver_id)
        AND "User".user_id IN (sr2.passenger_id, do2.driver_id)
    )
  );

-- El registro ocurre sin sesión (nadie autenticado todavía).
DROP POLICY IF EXISTS user_insert ON "User";
CREATE POLICY user_insert ON "User"
  FOR INSERT
  WITH CHECK (true);

-- Solo te editás a vos mismo, o un admin edita a cualquiera (p.ej. al
-- aprobar documentos y activar el rol DRIVER).
DROP POLICY IF EXISTS user_update ON "User";
CREATE POLICY user_update ON "User"
  FOR UPDATE
  USING (
    user_id = current_setting('app.current_user_id', true)::int
    OR current_setting('app.current_role', true) = 'ADMIN'
  )
  WITH CHECK (
    user_id = current_setting('app.current_user_id', true)::int
    OR current_setting('app.current_role', true) = 'ADMIN'
  );


-- ── 4. Tabla ServiceRequest ──────────────────────────────────────────────────
-- Pasajero ve (y cancela) sus propios viajes. Conductor ve las solicitudes
-- PENDING (para poder ofertar) y las que ya tienen alguna oferta suya (para
-- seguir su historial/estado). Admin ve todo.
DROP POLICY IF EXISTS servicerequest_select ON "ServiceRequest";
CREATE POLICY servicerequest_select ON "ServiceRequest"
  FOR SELECT
  USING (
    passenger_id = current_setting('app.current_user_id', true)::int
    OR current_setting('app.current_role', true) = 'ADMIN'
    OR (
      current_setting('app.current_role', true) = 'DRIVER'
      AND (
        status = 'PENDING'
        OR EXISTS (
          SELECT 1 FROM "DriverOffer" do3
          WHERE do3.request_id = "ServiceRequest".request_id
            AND do3.driver_id = current_setting('app.current_user_id', true)::int
        )
      )
    )
  );

DROP POLICY IF EXISTS servicerequest_insert ON "ServiceRequest";
CREATE POLICY servicerequest_insert ON "ServiceRequest"
  FOR INSERT
  WITH CHECK (passenger_id = current_setting('app.current_user_id', true)::int);

-- El pasajero cancela su viaje; el conductor con oferta ACCEPTED lo pasa a
-- IN_PROGRESS/COMPLETED; admin puede intervenir.
DROP POLICY IF EXISTS servicerequest_update ON "ServiceRequest";
CREATE POLICY servicerequest_update ON "ServiceRequest"
  FOR UPDATE
  USING (
    passenger_id = current_setting('app.current_user_id', true)::int
    OR current_setting('app.current_role', true) = 'ADMIN'
    OR EXISTS (
      SELECT 1 FROM "DriverOffer" do4
      WHERE do4.request_id = "ServiceRequest".request_id
        AND do4.driver_id = current_setting('app.current_user_id', true)::int
        AND do4.status = 'ACCEPTED'
    )
  );


-- ── 5. Tabla DriverOffer ─────────────────────────────────────────────────────
-- Conductor ve sus propias ofertas. Pasajero ve las ofertas hechas sobre SUS
-- viajes. Admin ve todo.
DROP POLICY IF EXISTS driveroffer_select ON "DriverOffer";
CREATE POLICY driveroffer_select ON "DriverOffer"
  FOR SELECT
  USING (
    driver_id = current_setting('app.current_user_id', true)::int
    OR current_setting('app.current_role', true) = 'ADMIN'
    OR EXISTS (
      SELECT 1 FROM "ServiceRequest" sr4
      WHERE sr4.request_id = "DriverOffer".request_id
        AND sr4.passenger_id = current_setting('app.current_user_id', true)::int
    )
  );

DROP POLICY IF EXISTS driveroffer_insert ON "DriverOffer";
CREATE POLICY driveroffer_insert ON "DriverOffer"
  FOR INSERT
  WITH CHECK (driver_id = current_setting('app.current_user_id', true)::int);

-- El conductor actualiza su oferta (contraoferta); el pasajero acepta,
-- rechaza o contraofrece la suya; admin puede intervenir.
DROP POLICY IF EXISTS driveroffer_update ON "DriverOffer";
CREATE POLICY driveroffer_update ON "DriverOffer"
  FOR UPDATE
  USING (
    driver_id = current_setting('app.current_user_id', true)::int
    OR current_setting('app.current_role', true) = 'ADMIN'
    OR EXISTS (
      SELECT 1 FROM "ServiceRequest" sr5
      WHERE sr5.request_id = "DriverOffer".request_id
        AND sr5.passenger_id = current_setting('app.current_user_id', true)::int
    )
  );


-- ── 6. Tabla Document ────────────────────────────────────────────────────────
-- Cada quien ve/sube solo sus propios documentos; admin ve y verifica todos.
DROP POLICY IF EXISTS document_select ON "Document";
CREATE POLICY document_select ON "Document"
  FOR SELECT
  USING (
    user_id = current_setting('app.current_user_id', true)::int
    OR current_setting('app.current_role', true) = 'ADMIN'
  );

DROP POLICY IF EXISTS document_insert ON "Document";
CREATE POLICY document_insert ON "Document"
  FOR INSERT
  WITH CHECK (user_id = current_setting('app.current_user_id', true)::int);

DROP POLICY IF EXISTS document_update ON "Document";
CREATE POLICY document_update ON "Document"
  FOR UPDATE
  USING (
    user_id = current_setting('app.current_user_id', true)::int
    OR current_setting('app.current_role', true) = 'ADMIN'
  );


-- ── 7. Tabla Notification ────────────────────────────────────────────────────
-- Cada quien ve/marca como leídas solo sus propias notificaciones. El INSERT
-- se deja abierto porque la app crea notificaciones PARA OTRO usuario todo
-- el tiempo (ej.: el pasajero acepta una oferta -> se notifica al
-- conductor) — quien manda esas peticiones nunca es la persona notificada.
DROP POLICY IF EXISTS notification_select ON "Notification";
CREATE POLICY notification_select ON "Notification"
  FOR SELECT
  USING (
    user_id = current_setting('app.current_user_id', true)::int
    OR current_setting('app.current_role', true) = 'ADMIN'
  );

DROP POLICY IF EXISTS notification_insert ON "Notification";
CREATE POLICY notification_insert ON "Notification"
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS notification_update ON "Notification";
CREATE POLICY notification_update ON "Notification"
  FOR UPDATE
  USING (user_id = current_setting('app.current_user_id', true)::int);
