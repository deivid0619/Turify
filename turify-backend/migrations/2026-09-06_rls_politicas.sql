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


-- ── 1.5 Funciones auxiliares (evitan la recursión entre políticas) ──────────
-- Postgres detecta y rechaza ("infinite recursion detected in policy") una
-- política que, para decidir si mostrar una fila, necesita consultar OTRA
-- tabla cuya propia política RLS vuelve a consultar la primera (por ejemplo:
-- la política de User consulta DriverOffer/ServiceRequest, y la de
-- ServiceRequest consulta DriverOffer, que a su vez consulta ServiceRequest).
--
-- La forma estándar de resolverlo es mover esas comprobaciones a funciones
-- SECURITY DEFINER: se ejecutan con los permisos de quien las creó (acá,
-- "postgres", que se salta el RLS), así la consulta de adentro no vuelve a
-- disparar ninguna política y el ciclo nunca se arma.
CREATE OR REPLACE FUNCTION rls_conectados_por_oferta_aceptada(p_user_a int, p_user_b int)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM "DriverOffer" do_
    JOIN "ServiceRequest" sr_ ON sr_.request_id = do_.request_id
    WHERE do_.status = 'ACCEPTED'
      AND p_user_a IN (sr_.passenger_id, do_.driver_id)
      AND p_user_b IN (sr_.passenger_id, do_.driver_id)
  );
$$;

CREATE OR REPLACE FUNCTION rls_conductor_tiene_oferta(p_driver_id int, p_request_id int)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM "DriverOffer"
    WHERE request_id = p_request_id AND driver_id = p_driver_id
  );
$$;

CREATE OR REPLACE FUNCTION rls_conductor_oferta_aceptada(p_driver_id int, p_request_id int)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM "DriverOffer"
    WHERE request_id = p_request_id AND driver_id = p_driver_id AND status = 'ACCEPTED'
  );
$$;

CREATE OR REPLACE FUNCTION rls_es_dueno_del_viaje(p_passenger_id int, p_request_id int)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM "ServiceRequest"
    WHERE request_id = p_request_id AND passenger_id = p_passenger_id
  );
$$;

GRANT EXECUTE ON FUNCTION rls_conectados_por_oferta_aceptada(int, int) TO turify_app;
GRANT EXECUTE ON FUNCTION rls_conductor_tiene_oferta(int, int) TO turify_app;
GRANT EXECUTE ON FUNCTION rls_conductor_oferta_aceptada(int, int) TO turify_app;
GRANT EXECUTE ON FUNCTION rls_es_dueno_del_viaje(int, int) TO turify_app;


-- ── 1.6 Funciones de contexto NULL-safe (evitan castear "" a integer) ──────
-- Postgres, la primera vez que se usa un parámetro de sesión "custom" (como
-- app.current_user_id) con SET LOCAL, deja creado un "placeholder" para ese
-- parámetro a nivel de la conexión física. Cuando esa transacción termina,
-- el parámetro NO vuelve a quedar realmente "sin definir": queda con texto
-- vacío (""), no NULL. Como get_current_user() necesita primero LEER al
-- usuario (para saber quién es) ANTES de poder hacer el SET LOCAL de esa
-- misma petición, esa primera consulta puede toparse con "" en vez de NULL
-- en conexiones ya reutilizadas del pool -- y castear "" a integer explota
-- ("invalid input syntax for type integer"). Estas funciones normalizan ""
-- a NULL antes de castear, para todos los usos de abajo.
CREATE OR REPLACE FUNCTION app_current_user_id()
RETURNS int
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::int;
$$;

CREATE OR REPLACE FUNCTION app_current_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_role', true), '');
$$;

GRANT EXECUTE ON FUNCTION app_current_user_id() TO turify_app;
GRANT EXECUTE ON FUNCTION app_current_role() TO turify_app;


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
    app_current_user_id() IS NULL
    OR user_id = app_current_user_id()
    OR app_current_role() = 'ADMIN'
    OR role = 'DRIVER'
    OR rls_conectados_por_oferta_aceptada(
      app_current_user_id(),
      "User".user_id
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
    user_id = app_current_user_id()
    OR app_current_role() = 'ADMIN'
  )
  WITH CHECK (
    user_id = app_current_user_id()
    OR app_current_role() = 'ADMIN'
  );


-- ── 4. Tabla ServiceRequest ──────────────────────────────────────────────────
-- Pasajero ve (y cancela) sus propios viajes. Conductor ve las solicitudes
-- PENDING (para poder ofertar) y las que ya tienen alguna oferta suya (para
-- seguir su historial/estado). Admin ve todo.
DROP POLICY IF EXISTS servicerequest_select ON "ServiceRequest";
CREATE POLICY servicerequest_select ON "ServiceRequest"
  FOR SELECT
  USING (
    passenger_id = app_current_user_id()
    OR app_current_role() = 'ADMIN'
    OR (
      app_current_role() = 'DRIVER'
      AND (
        status = 'PENDING'
        OR rls_conductor_tiene_oferta(
          app_current_user_id(),
          "ServiceRequest".request_id
        )
      )
    )
  );

DROP POLICY IF EXISTS servicerequest_insert ON "ServiceRequest";
CREATE POLICY servicerequest_insert ON "ServiceRequest"
  FOR INSERT
  WITH CHECK (passenger_id = app_current_user_id());

-- El pasajero cancela su viaje; el conductor con oferta ACCEPTED lo pasa a
-- IN_PROGRESS/COMPLETED; admin puede intervenir.
DROP POLICY IF EXISTS servicerequest_update ON "ServiceRequest";
CREATE POLICY servicerequest_update ON "ServiceRequest"
  FOR UPDATE
  USING (
    passenger_id = app_current_user_id()
    OR app_current_role() = 'ADMIN'
    OR rls_conductor_oferta_aceptada(
      app_current_user_id(),
      "ServiceRequest".request_id
    )
  );


-- ── 5. Tabla DriverOffer ─────────────────────────────────────────────────────
-- Conductor ve sus propias ofertas. Pasajero ve las ofertas hechas sobre SUS
-- viajes. Admin ve todo.
DROP POLICY IF EXISTS driveroffer_select ON "DriverOffer";
CREATE POLICY driveroffer_select ON "DriverOffer"
  FOR SELECT
  USING (
    driver_id = app_current_user_id()
    OR app_current_role() = 'ADMIN'
    OR rls_es_dueno_del_viaje(
      app_current_user_id(),
      "DriverOffer".request_id
    )
  );

DROP POLICY IF EXISTS driveroffer_insert ON "DriverOffer";
CREATE POLICY driveroffer_insert ON "DriverOffer"
  FOR INSERT
  WITH CHECK (driver_id = app_current_user_id());

-- El conductor actualiza su oferta (contraoferta); el pasajero acepta,
-- rechaza o contraofrece la suya; admin puede intervenir.
DROP POLICY IF EXISTS driveroffer_update ON "DriverOffer";
CREATE POLICY driveroffer_update ON "DriverOffer"
  FOR UPDATE
  USING (
    driver_id = app_current_user_id()
    OR app_current_role() = 'ADMIN'
    OR rls_es_dueno_del_viaje(
      app_current_user_id(),
      "DriverOffer".request_id
    )
  );


-- ── 6. Tabla Document ────────────────────────────────────────────────────────
-- Cada quien ve/sube solo sus propios documentos; admin ve y verifica todos.
DROP POLICY IF EXISTS document_select ON "Document";
CREATE POLICY document_select ON "Document"
  FOR SELECT
  USING (
    user_id = app_current_user_id()
    OR app_current_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS document_insert ON "Document";
CREATE POLICY document_insert ON "Document"
  FOR INSERT
  WITH CHECK (user_id = app_current_user_id());

DROP POLICY IF EXISTS document_update ON "Document";
CREATE POLICY document_update ON "Document"
  FOR UPDATE
  USING (
    user_id = app_current_user_id()
    OR app_current_role() = 'ADMIN'
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
    user_id = app_current_user_id()
    OR app_current_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS notification_insert ON "Notification";
CREATE POLICY notification_insert ON "Notification"
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS notification_update ON "Notification";
CREATE POLICY notification_update ON "Notification"
  FOR UPDATE
  USING (user_id = app_current_user_id());


-- ── 8. Tabla Vehicle (agregada tras encontrar el bug en produccion) ─────────
-- No estaba en el alcance original de esta HU, pero al activar turify_app en
-- Supabase, Postgres tira "new row violates row-level security policy for
-- table Vehicle" -- Vehicle ya tenia RLS activado (probablemente por defecto
-- del editor de tablas de Supabase) pero sin ninguna politica, lo que
-- bloquea TODO por defecto, incluso insertar tu propio vehiculo.
--
-- Los datos de un vehiculo (placa, capacidad, comodidades, foto) no son
-- sensibles como un documento o un dato personal -- son necesarios para que
-- cualquier pasajero pueda ver el perfil publico de un conductor y para que
-- el backend arme coincidencias de comodidades entre conductores y viajes,
-- asi que el SELECT queda abierto a cualquiera (autenticado o no), igual que
-- los perfiles de rol DRIVER en la tabla User.
ALTER TABLE "Vehicle" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vehicle_select ON "Vehicle";
CREATE POLICY vehicle_select ON "Vehicle"
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS vehicle_insert ON "Vehicle";
CREATE POLICY vehicle_insert ON "Vehicle"
  FOR INSERT
  WITH CHECK (owner_id = app_current_user_id());

-- El dueno actualiza su propio vehiculo (ej. tarifas personalizadas,
-- comodidades); admin puede intervenir.
DROP POLICY IF EXISTS vehicle_update ON "Vehicle";
CREATE POLICY vehicle_update ON "Vehicle"
  FOR UPDATE
  USING (
    owner_id = app_current_user_id()
    OR app_current_role() = 'ADMIN'
  );


-- ── 9. Tablas restantes -- encontradas con RLS activado sin politicas ──────
-- Al revisar production con `SELECT tablename, rowsecurity FROM pg_tables`
-- aparecio que Supabase tenia TODAS las tablas de la app con RLS activado
-- (no solo las 6 de arriba) pero sin ninguna politica -- probablemente un
-- comportamiento por defecto del propio Supabase al crear las tablas. Sin
-- politicas, cualquier INSERT/SELECT con turify_app queda bloqueado por
-- defecto. Se agregan las que faltaban, revisando antes en el codigo quien
-- necesita acceder a cada una.

-- AffiliatedCompany: catalogo de empresas afiliadas (nombre, NIT, logo) --
-- dato no sensible, se lee para mostrar el nombre de la empresa en perfiles.
-- No hay endpoint que la modifique desde la API; se deja el INSERT/UPDATE
-- solo para ADMIN por si se administra a mano.
ALTER TABLE "AffiliatedCompany" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS affiliatedcompany_select ON "AffiliatedCompany";
CREATE POLICY affiliatedcompany_select ON "AffiliatedCompany"
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS affiliatedcompany_insert ON "AffiliatedCompany";
CREATE POLICY affiliatedcompany_insert ON "AffiliatedCompany"
  FOR INSERT
  WITH CHECK (app_current_role() = 'ADMIN');

DROP POLICY IF EXISTS affiliatedcompany_update ON "AffiliatedCompany";
CREATE POLICY affiliatedcompany_update ON "AffiliatedCompany"
  FOR UPDATE
  USING (app_current_role() = 'ADMIN');

-- AuditLog: la bitacora de seguridad (OWASP A09). Solo ADMIN puede leerla o
-- borrarla (el script de retencion la usa); el INSERT queda abierto porque
-- `registrar_log` se llama tanto para usuarios autenticados como para
-- eventos SIN sesion (ej. un login fallido, antes de saber quien es).
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auditlog_select ON "AuditLog";
CREATE POLICY auditlog_select ON "AuditLog"
  FOR SELECT
  USING (app_current_role() = 'ADMIN');

DROP POLICY IF EXISTS auditlog_insert ON "AuditLog";
CREATE POLICY auditlog_insert ON "AuditLog"
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS auditlog_delete ON "AuditLog";
CREATE POLICY auditlog_delete ON "AuditLog"
  FOR DELETE
  USING (app_current_role() = 'ADMIN');

-- TripPassenger: ocupantes del viaje (FUEC) -- datos personales (nombre,
-- documento). Solo el pasajero dueno del viaje, el conductor con oferta
-- ACCEPTED en ese viaje, o ADMIN pueden verlos; solo el pasajero dueno los
-- crea o borra (el endpoint borra y vuelve a crear en cada actualizacion).
ALTER TABLE "TripPassenger" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trippassenger_select ON "TripPassenger";
CREATE POLICY trippassenger_select ON "TripPassenger"
  FOR SELECT
  USING (
    rls_es_dueno_del_viaje(app_current_user_id(), "TripPassenger".request_id)
    OR rls_conductor_oferta_aceptada(app_current_user_id(), "TripPassenger".request_id)
    OR app_current_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS trippassenger_insert ON "TripPassenger";
CREATE POLICY trippassenger_insert ON "TripPassenger"
  FOR INSERT
  WITH CHECK (rls_es_dueno_del_viaje(app_current_user_id(), "TripPassenger".request_id));

DROP POLICY IF EXISTS trippassenger_delete ON "TripPassenger";
CREATE POLICY trippassenger_delete ON "TripPassenger"
  FOR DELETE
  USING (rls_es_dueno_del_viaje(app_current_user_id(), "TripPassenger".request_id));

-- Rating: calificaciones bidireccionales -- son reputacion publica (se usan
-- para mostrar el promedio de CUALQUIER usuario), por eso el SELECT queda
-- abierto. Solo el propio calificador puede insertar su calificacion.
ALTER TABLE "Rating" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rating_select ON "Rating";
CREATE POLICY rating_select ON "Rating"
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS rating_insert ON "Rating";
CREATE POLICY rating_insert ON "Rating"
  FOR INSERT
  WITH CHECK (rater_id = app_current_user_id());

-- TripStop y PriceHistory: ninguna de las dos tiene todavia un endpoint que
-- las use (TripStop es para paradas intermedias, PriceHistory es para la
-- futura Epica 12 de precio sugerido por IA) -- se dejan restringidas solo
-- a ADMIN como placeholder seguro, para revisar cuando se implementen.
ALTER TABLE "TripStop" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tripstop_admin_only ON "TripStop";
CREATE POLICY tripstop_admin_only ON "TripStop"
  FOR ALL
  USING (app_current_role() = 'ADMIN')
  WITH CHECK (app_current_role() = 'ADMIN');

ALTER TABLE "PriceHistory" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pricehistory_admin_only ON "PriceHistory";
CREATE POLICY pricehistory_admin_only ON "PriceHistory"
  FOR ALL
  USING (app_current_role() = 'ADMIN')
  WITH CHECK (app_current_role() = 'ADMIN');
