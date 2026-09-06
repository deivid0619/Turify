"""
Prueba de acceso cruzado para las politicas RLS (SCRUM-216, OWASP A01).

Se conecta a la base con el ROL RESTRINGIDO (turify_app, NO "postgres") y
verifica que un usuario autenticado como A no puede ver los documentos ni
las notificaciones de otro usuario B -- que es justo lo que deberian
garantizar las politicas de migrations/2026-09-06_rls_politicas.sql.

Si conectas este script con las credenciales de "postgres" en vez de
"turify_app", TODAS las pruebas van a "pasar" de forma enganosa (en
realidad no estarian probando nada, porque "postgres" se salta el RLS
por completo). Este script no puede detectar ese error por vos: fijate
bien en la URL que le pasas.

Requiere:
  - Haber corrido migrations/2026-09-06_rls_politicas.sql (rol turify_app +
    politicas) contra la base que vas a probar (local o Supabase).
  - Que existan al menos 2 usuarios reales en la tabla User.

Uso:
    python3 scripts/test_rls_acceso_cruzado.py "postgresql://turify_app:CLAVE@localhost:5432/turify_db"

Si no pasas la URL por argumento, se usa la variable de entorno
TURIFY_APP_DB_URL.
"""
import os
import sys

from sqlalchemy import create_engine, text


def _falla(msg: str) -> bool:
    print(f"[FALLA] {msg}")
    return False


def _ok(msg: str) -> bool:
    print(f"[OK] {msg}")
    return True


def main():
    url = sys.argv[1] if len(sys.argv) > 1 else os.getenv("TURIFY_APP_DB_URL")
    if not url:
        print("Falta la URL de conexion (argumento o variable TURIFY_APP_DB_URL). Ver el docstring de este script.")
        sys.exit(1)

    if "postgres:" in url.split("@")[0]:
        print(
            "Esta URL se conecta como \"postgres\" -- ese rol se salta el RLS y esta "
            "prueba no serviria de nada. Usa las credenciales de \"turify_app\"."
        )
        sys.exit(1)

    engine = create_engine(url)
    resultados = []

    with engine.connect() as conn:
        usuarios = conn.execute(text('SELECT user_id, role FROM "User" ORDER BY user_id LIMIT 2')).fetchall()
        if len(usuarios) < 2:
            print("Necesito al menos 2 usuarios en la tabla User para poder probar el acceso cruzado.")
            sys.exit(1)
        (usuario_a, rol_a), (usuario_b, rol_b) = usuarios
        print(f"Probando con usuario A = #{usuario_a} ({rol_a}) y usuario B = #{usuario_b} ({rol_b})\n")

    # --- A no deberia poder ver los documentos de B ---
    with engine.connect() as conn, conn.begin():
        conn.execute(text("SET LOCAL app.current_user_id = :v"), {"v": str(usuario_a)})
        conn.execute(text("SET LOCAL app.current_role = :v"), {"v": rol_a})
        docs_de_b = conn.execute(
            text('SELECT document_id FROM "Document" WHERE user_id = :b'), {"b": usuario_b}
        ).fetchall()
    resultados.append(
        _ok("A no ve documentos de B (0 filas)") if len(docs_de_b) == 0
        else _falla(f"A SI ve {len(docs_de_b)} documento(s) de B -- RLS no esta filtrando Document.")
    )

    # --- A no deberia poder ver las notificaciones de B ---
    with engine.connect() as conn, conn.begin():
        conn.execute(text("SET LOCAL app.current_user_id = :v"), {"v": str(usuario_a)})
        conn.execute(text("SET LOCAL app.current_role = :v"), {"v": rol_a})
        notifs_de_b = conn.execute(
            text('SELECT notification_id FROM "Notification" WHERE user_id = :b'), {"b": usuario_b}
        ).fetchall()
    resultados.append(
        _ok("A no ve notificaciones de B (0 filas)") if len(notifs_de_b) == 0
        else _falla(f"A SI ve {len(notifs_de_b)} notificacion(es) de B -- RLS no esta filtrando Notification.")
    )

    # --- A si deberia poder ver su propio perfil ---
    with engine.connect() as conn, conn.begin():
        conn.execute(text("SET LOCAL app.current_user_id = :v"), {"v": str(usuario_a)})
        conn.execute(text("SET LOCAL app.current_role = :v"), {"v": rol_a})
        propio = conn.execute(
            text('SELECT user_id FROM "User" WHERE user_id = :a'), {"a": usuario_a}
        ).fetchall()
    resultados.append(
        _ok("A si ve su propio perfil") if len(propio) == 1
        else _falla("A no pudo ver su propio perfil -- la politica de User quedo demasiado restrictiva.")
    )

    # --- Sin ningun contexto (anonimo), no deberia ver documentos de nadie ---
    with engine.connect() as conn, conn.begin():
        todos_los_docs = conn.execute(text('SELECT document_id FROM "Document"')).fetchall()
    resultados.append(
        _ok("Sin sesion (anonimo) no se ven documentos de nadie (0 filas)") if len(todos_los_docs) == 0
        else _falla(f"Sin sesion se ven {len(todos_los_docs)} documento(s) -- Document quedo sin RLS real.")
    )

    print()
    if all(resultados):
        print("Todas las pruebas de acceso cruzado pasaron.")
        sys.exit(0)
    else:
        print("Alguna prueba fallo -- revisa las politicas antes de usar este rol en produccion.")
        sys.exit(1)


if __name__ == "__main__":
    main()
