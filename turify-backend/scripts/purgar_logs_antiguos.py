"""
Script de mantenimiento -- purga registros de AuditLog mas antiguos que
LOG_RETENTION_DIAS (por defecto 365 dias).

HU seguridad (OWASP A09) -- criterio de aceptacion: "Retencion de logs minimo
90 dias". Este script nunca borra nada mas reciente que 90 dias, sin importar
que tan bajo se configure --dias o LOG_RETENTION_DIAS, para que ese minimo no
se pueda romper por accidente.

No hay un scheduler (cron/Celery) corriendo dentro de los contenedores de
Turify, asi que este script esta pensado para ejecutarse a mano, o programarlo
como tarea periodica del sistema operativo donde corra el backend -- por
ejemplo con un cron de Linux que llame al contenedor:

    0 3 * * 0  cd /ruta/al/proyecto && docker compose exec -T backend \
               python3 scripts/purgar_logs_antiguos.py

Uso manual (desde dentro del contenedor backend, o con el entorno del
backend activado):

    python3 scripts/purgar_logs_antiguos.py             # usa el valor por defecto (365 dias)
    python3 scripts/purgar_logs_antiguos.py --dias 180   # purga lo anterior a 180 dias
    python3 scripts/purgar_logs_antiguos.py --dry-run    # solo cuenta, no borra nada
"""
import argparse
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app import models

RETENCION_MINIMA_DIAS = 90


def purgar(dias: int, dry_run: bool = False) -> int:
    if dias < RETENCION_MINIMA_DIAS:
        raise SystemExit(
            f"No se puede purgar con menos de {RETENCION_MINIMA_DIAS} dias de "
            f"retencion (pediste {dias}). Ese minimo es un requisito de seguridad."
        )

    limite = datetime.now(timezone.utc) - timedelta(days=dias)
    db = SessionLocal()
    try:
        query = db.query(models.AuditLog).filter(models.AuditLog.created_at < limite)
        total = query.count()
        if dry_run:
            print(f"[dry-run] Se borrarian {total} registros de AuditLog anteriores a {limite.date()}.")
            return total
        query.delete(synchronize_session=False)
        db.commit()
        print(f"Se borraron {total} registros de AuditLog anteriores a {limite.date()}.")
        return total
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Purga registros antiguos de AuditLog.")
    parser.add_argument(
        "--dias", type=int,
        default=int(os.getenv("LOG_RETENTION_DIAS", "365")),
        help=f"Dias de retencion antes de borrar (minimo {RETENCION_MINIMA_DIAS}). Por defecto 365, o LOG_RETENTION_DIAS.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Solo cuenta, no borra nada.")
    args = parser.parse_args()
    purgar(args.dias, dry_run=args.dry_run)
