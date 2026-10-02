-- Cierra lo que le quedaba a la llave pública de Supabase (roles anon y
-- authenticated). La app no usa esos roles: el backend entra como postgres y
-- el navegador solo usa la llave pública para Realtime, que ya no tenía
-- permiso de lectura sobre ninguna tabla.
--
-- Solo QUITA permisos. Es idempotente: se puede correr más de una vez.
-- Auditoría del 2026-09-28 (solo lectura) que la motivó:
--   · anon/authenticated tenían REFERENCES, TRIGGER y TRUNCATE en las tablas
--     de la app. TRUNCATE no respeta RLS.
--   · Los privilegios por defecto de postgres les seguían dando esos permisos
--     a las tablas nuevas.
--   · Cuatro funciones de RLS (SECURITY DEFINER) se podían llamar por RPC con
--     la llave pública y respondían si un usuario es dueño de un viaje o si
--     dos usuarios tienen un viaje juntos.

-- 1. Tablas, vistas y secuencias de public.
--    Las de PostGIS (spatial_ref_sys y sus vistas) son de supabase_admin: ahí
--    Postgres avisa "no privileges could be revoked" y no pasa nada más.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- 2. Lo mismo para lo que se cree de ahora en adelante (el backend crea
--    tablas con create_all al arrancar). El trigger ensure_rls ya les activa
--    RLS; esto además evita que nazcan con permisos para la llave pública.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- 3. Funciones auxiliares de las políticas: solo las necesitan el dueño
--    (postgres) y el rol turify_app, si algún día el backend entra con él.
REVOKE EXECUTE ON FUNCTION public.rls_es_dueno_del_viaje(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_conductor_tiene_oferta(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_conductor_oferta_aceptada(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_conectados_por_oferta_aceptada(integer, integer) FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'turify_app') THEN
    GRANT EXECUTE ON FUNCTION public.rls_es_dueno_del_viaje(integer, integer) TO turify_app;
    GRANT EXECUTE ON FUNCTION public.rls_conductor_tiene_oferta(integer, integer) TO turify_app;
    GRANT EXECUTE ON FUNCTION public.rls_conductor_oferta_aceptada(integer, integer) TO turify_app;
    GRANT EXECUTE ON FUNCTION public.rls_conectados_por_oferta_aceptada(integer, integer) TO turify_app;
  END IF;
END $$;
