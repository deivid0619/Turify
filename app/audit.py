from sqlalchemy.orm import Session
from app import models


def registrar_log(
    db: Session,
    action: str,
    user_id: int = None,
    entity: str = None,
    entity_id: int = None,
    detail: str = None,
    ip_address: str = None
):
    """
    Registra una acción en la tabla AuditLog.

    Acciones disponibles:
    - LOGIN              : Login exitoso
    - LOGIN_FAILED       : Login fallido
    - REGISTER           : Registro de nuevo usuario
    - CREATE_TRIP        : Pasajero crea solicitud de viaje
    - CREATE_OFFER       : Conductor envía oferta
    - VERIFY_DOCUMENT    : Admin aprueba o rechaza documento
    - REGISTER_DRIVER    : Conductor envía documentos
    """
    try:
        log = models.AuditLog(
            user_id=user_id,
            action=action,
            entity=entity,
            entity_id=entity_id,
            detail=detail,
            ip_address=ip_address
        )
        db.add(log)
        db.commit()
    except Exception as e:
        # El log nunca debe interrumpir el flujo principal
        db.rollback()
        print(f"[AuditLog] Error al registrar log: {e}")