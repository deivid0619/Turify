-- ============================================================================
-- TURIFY — Migración de base de datos (septiembre 2026)
-- Pegar y ejecutar en el editor SQL de Supabase (Project > SQL Editor)
-- Cubre los 3 cambios revisados hoy:
--   1) HU09 — búsqueda automática de conductores (columnas nuevas de comodidades
--      exigidas por el pasajero en ServiceRequest)
--   2) Seguridad — hasheo automático de password_hash para usuarios creados
--      desde el editor de tablas de Supabase (que NO pasan por el backend)
--   3) HU38 — comodidades como filtro de búsqueda (mismas columnas del punto 1)
--
-- IMPORTANTE: el proyecto no tiene migraciones automáticas (Alembic), así que
-- cada vez que el código (models.py) agrega una columna nueva hay que
-- replicarla aquí manualmente. Sin esto, el backend fallará al intentar leer
-- o escribir estas columnas.
-- ============================================================================


-- ============================================================================
-- 1) HU09 / HU38 — Nuevas columnas en "ServiceRequest": comodidades que el
--    pasajero exige del vehículo al publicar el viaje. Si las 7 quedan en
--    false, no se filtra por comodidades (comportamiento igual al actual).
-- ============================================================================

ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS requiere_ac              boolean DEFAULT false;
ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS requiere_wifi            boolean DEFAULT false;
ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS requiere_bano            boolean DEFAULT false;
ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS requiere_musica          boolean DEFAULT false;
ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS requiere_maletero_amplio boolean DEFAULT false;
ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS requiere_sillas_bebe     boolean DEFAULT false;
ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS requiere_acepta_mascotas boolean DEFAULT false;

-- Opcional — homogeneizar los viajes PENDING que ya existían antes de este
-- cambio: ahora todo viaje nuevo se publica con un radio de visibilidad de
-- 60km automático (RADIO_VISIBILIDAD_KM en service_requests.py) en vez del
-- radio manual que elegía el pasajero. Si quieres que los viajes ya
-- publicados (y aún pendientes) también se beneficien del radio ampliado,
-- descomenta esto:

-- UPDATE "ServiceRequest"
-- SET search_radius_km = 60
-- WHERE status = 'PENDING' AND (search_radius_km IS NULL OR search_radius_km < 60);


-- ============================================================================
-- 2) Seguridad — hasheo automático de contraseñas creadas desde el editor de
--    tablas de Supabase. El backend (app/security.py) siempre hashea con
--    bcrypt (vía passlib) antes de guardar, pero si alguien inserta o edita
--    un usuario directo en la tabla "User" desde la interfaz de Supabase, esa
--    escritura NO pasa por el backend y el password_hash queda en texto plano
--    (como se vio en la fila de "Francisco gomez": password_hash = "123456").
--
--    Solución: un trigger a nivel de base de datos que, justo antes de
--    guardar cualquier INSERT o UPDATE de password_hash, revisa si el valor
--    YA tiene formato de hash bcrypt ($2a$/$2b$/$2y$ + 60 caracteres). Si no
--    lo tiene (es decir, alguien escribió una contraseña en texto plano), lo
--    hashea automáticamente con bcrypt (vía la extensión pgcrypto) antes de
--    guardarlo. Si ya viene hasheado (como cuando el backend lo hace), el
--    trigger no lo toca — así no se rompe el login de los usuarios creados
--    normalmente desde la app.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION hashear_password_si_no_esta_hasheada()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.password_hash IS NOT NULL
       AND NEW.password_hash !~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$' THEN
        NEW.password_hash := crypt(NEW.password_hash, gen_salt('bf', 12));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hashear_password ON "User";
CREATE TRIGGER trg_hashear_password
BEFORE INSERT OR UPDATE OF password_hash ON "User"
FOR EACH ROW
EXECUTE FUNCTION hashear_password_si_no_esta_hasheada();


-- ----------------------------------------------------------------------------
-- 2.1) Limpieza de usuarios YA creados con contraseña en texto plano (como el
--      de la captura). Esto arregla los datos existentes; el trigger de
--      arriba evita que vuelva a pasar con usuarios NUEVOS o editados.
--      Es seguro ejecutarla más de una vez: solo toca filas que no tengan ya
--      formato bcrypt.
-- ----------------------------------------------------------------------------

UPDATE "User"
SET password_hash = crypt(password_hash, gen_salt('bf', 12))
WHERE password_hash !~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$';

-- Para revisar qué filas quedaron afectadas (ejecutar ANTES de la limpieza si
-- quieres ver cuáles se van a corregir):
-- SELECT user_id, full_name, email, password_hash
-- FROM "User"
-- WHERE password_hash !~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$';


-- ============================================================================
-- NOTA — esto no reemplaza la buena práctica: sigue sin ser recomendable crear
-- usuarios reales desde el editor de tablas de Supabase (no pasa por las
-- validaciones del backend: formato de email, teléfono obligatorio, rol
-- correcto, etc.). El trigger es una red de seguridad para que, si alguien lo
-- hace de todos modos (por ejemplo en clase, como pasó hoy), el login no
-- quede roto por una contraseña sin hashear.
-- ============================================================================
