"""Autorización para el tratamiento de datos personales.

La Ley 1581 de 2012 (art. 9) exige una autorización previa, expresa e
informada, y el Decreto 1377 de 2013 (art. 8) obliga a guardar prueba de ella.
La prueba queda en AuditLog (RLS activo y sin acceso público) con la versión
de las políticas que la persona aceptó. Cuando las políticas cambian,
VERSION_POLITICAS cambia y la app vuelve a pedir la aceptación.
"""
from sqlalchemy.orm import Session

from app import models

# Fecha de la "Última actualización" de /politicas (Politicas.jsx). Si se
# cambia, todos los usuarios tienen que volver a aceptar.
VERSION_POLITICAS = "2026-09-28"

ACEPTA_POLITICAS = "ACEPTA_POLITICAS"      # Términos + tratamiento de datos (toda cuenta)
AUTORIZA_CONDUCTOR = "AUTORIZA_CONDUCTOR"  # revisión de documentos y ubicación del conductor
AUTORIZA_OCUPANTES = "AUTORIZA_OCUPANTES"  # el pasajero declara la autorización de sus ocupantes


def registrar(db: Session, accion: str, usuario_id: int, detalle: str, *, ip: str | None = None,
              entidad: str = "User", entidad_id: int | None = None) -> None:
    """Agrega la prueba a la sesión SIN hacer commit: se guarda en la misma
    transacción que lo que autoriza, así nunca queda lo uno sin lo otro."""
    db.add(models.AuditLog(
        user_id=usuario_id,
        action=accion,
        entity=entidad,
        entity_id=entidad_id if entidad_id is not None else usuario_id,
        detail=f"[{VERSION_POLITICAS}] {detalle}",
        ip_address=ip,
    ))


def politicas_vigentes(db: Session, usuario_id: int) -> bool:
    """¿La persona ya aceptó la versión actual de los Términos y la Política de datos?"""
    return db.query(models.AuditLog.log_id).filter(
        models.AuditLog.user_id == usuario_id,
        models.AuditLog.action == ACEPTA_POLITICAS,
        models.AuditLog.detail.startswith(f"[{VERSION_POLITICAS}]"),
    ).first() is not None
