-- ============================================================================
-- Turify — Validaciones a nivel de base de datos (Supabase / PostgreSQL)
-- ----------------------------------------------------------------------------
-- Estas restricciones son la última línea de defensa: aunque alguien salte el
-- frontend y el backend (por ejemplo pegando directo contra la API o la BD),
-- la base rechaza datos con formato inválido.
--
-- Se agregan como NOT VALID: se aplican a TODO lo que se inserte o actualice
-- de aquí en adelante, pero NO revientan si ya hay filas viejas que no cumplen.
-- Cuando confirmes que los datos históricos están limpios, puedes ejecutar el
-- bloque VALIDATE del final para exigirlas también sobre lo ya guardado.
--
-- Ejecutar en: Supabase -> SQL Editor -> New query -> pegar y Run.
-- Es idempotente: si una restricción ya existe, se omite.
-- ============================================================================

-- ── Usuarios ────────────────────────────────────────────────────────────────
DO $$ BEGIN
  -- Correo con formato real (algo@algo.dominio)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_user_email') THEN
    ALTER TABLE "User" ADD CONSTRAINT ck_user_email
      CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$') NOT VALID;
  END IF;

  -- Teléfono: solo dígitos (con un + opcional), de 7 a 15. Nunca letras.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_user_phone') THEN
    ALTER TABLE "User" ADD CONSTRAINT ck_user_phone
      CHECK (phone_number ~ '^\+?[0-9]{7,15}$') NOT VALID;
  END IF;

  -- Edad en un rango humano
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_user_age') THEN
    ALTER TABLE "User" ADD CONSTRAINT ck_user_age
      CHECK (age IS NULL OR (age >= 0 AND age <= 120)) NOT VALID;
  END IF;

  -- Nombre con al menos 3 caracteres
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_user_name_len') THEN
    ALTER TABLE "User" ADD CONSTRAINT ck_user_name_len
      CHECK (char_length(full_name) >= 3) NOT VALID;
  END IF;
END $$;

-- ── Solicitudes de servicio ─────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_sr_adults') THEN
    ALTER TABLE "ServiceRequest" ADD CONSTRAINT ck_sr_adults
      CHECK (adults_count >= 1) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_sr_children') THEN
    ALTER TABLE "ServiceRequest" ADD CONSTRAINT ck_sr_children
      CHECK (children_count >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_sr_infants') THEN
    ALTER TABLE "ServiceRequest" ADD CONSTRAINT ck_sr_infants
      CHECK (infants_count >= 0) NOT VALID;
  END IF;
  -- El regreso, si existe, debe ser posterior a la salida
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_sr_return_after') THEN
    ALTER TABLE "ServiceRequest" ADD CONSTRAINT ck_sr_return_after
      CHECK (return_time IS NULL OR return_time > departure_time) NOT VALID;
  END IF;
END $$;

-- ── Ocupantes del viaje (FUEC) ──────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_tp_name_len') THEN
    ALTER TABLE "TripPassenger" ADD CONSTRAINT ck_tp_name_len
      CHECK (char_length(full_name) >= 3) NOT VALID;
  END IF;
  -- Documento según su tipo: CC/TI numérico (5-10), CE/PA alfanumérico (5-15)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_tp_document') THEN
    ALTER TABLE "TripPassenger" ADD CONSTRAINT ck_tp_document
      CHECK (
        (document_type IN ('CC','TI') AND document_number ~ '^[0-9]{5,10}$') OR
        (document_type IN ('CE','PA') AND document_number ~ '^[A-Za-z0-9]{5,15}$')
      ) NOT VALID;
  END IF;
END $$;

-- ── Calificaciones ──────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_rating_score') THEN
    ALTER TABLE "Rating" ADD CONSTRAINT ck_rating_score
      CHECK (score >= 1 AND score <= 5) NOT VALID;
  END IF;
END $$;

-- ============================================================================
-- OPCIONAL — exigir las reglas también sobre los datos YA guardados.
-- Ejecuta esto solo si estás seguro de que no hay filas históricas inválidas
-- (si alguna fila vieja no cumple, el VALIDATE correspondiente fallará y te
-- dirá cuál revisar). Puedes correrlos de a uno.
-- ============================================================================
-- ALTER TABLE "User"           VALIDATE CONSTRAINT ck_user_email;
-- ALTER TABLE "User"           VALIDATE CONSTRAINT ck_user_phone;
-- ALTER TABLE "User"           VALIDATE CONSTRAINT ck_user_age;
-- ALTER TABLE "User"           VALIDATE CONSTRAINT ck_user_name_len;
-- ALTER TABLE "ServiceRequest" VALIDATE CONSTRAINT ck_sr_adults;
-- ALTER TABLE "ServiceRequest" VALIDATE CONSTRAINT ck_sr_children;
-- ALTER TABLE "ServiceRequest" VALIDATE CONSTRAINT ck_sr_infants;
-- ALTER TABLE "ServiceRequest" VALIDATE CONSTRAINT ck_sr_return_after;
-- ALTER TABLE "TripPassenger"  VALIDATE CONSTRAINT ck_tp_name_len;
-- ALTER TABLE "TripPassenger"  VALIDATE CONSTRAINT ck_tp_document;
-- ALTER TABLE "Rating"         VALIDATE CONSTRAINT ck_rating_score;
