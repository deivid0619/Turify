"""
Orquestador del motor de precio — el único punto que los routers deben llamar.

Decide entre modelo de ML y fórmula de reglas, entrena/cachea el modelo,
arma la respuesta final (con desglose siempre coherente con el total) y
registra el resultado real de cada viaje completado para que el histórico de
entrenamiento crezca solo con el tiempo.
"""
from __future__ import annotations

import logging
from contextlib import contextmanager
from dataclasses import replace

from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models
from app.database import SessionLocal

from . import constants as k
from .features import PricingInput, construir_features
from .ml_model import ModeloPrecioSugerido
from .resultado import ComponentePrecio, ResultadoPrecio
from .rules_engine import calcular_precio_reglas
from .synthetic_data import generar_dataset_sintetico
from .tarifas_referencia import factor_ida_y_vuelta

logger = logging.getLogger("turify.pricing")

# Cache del modelo entrenado, a nivel de proceso. Se entrena una vez (perezoso,
# en la primera solicitud que lo necesite) y se reutiliza en las siguientes
# — entrenar una regresión lineal sobre unos cientos/miles de filas toma
# milisegundos, así que no hace falta persistir el modelo a disco: en cada
# arranque del proceso (cada deploy en Render) se vuelve a entrenar solo.
_modelo_cache: ModeloPrecioSugerido | None = None
_fuente_modelo_cache: str | None = None  # "REAL" | "SINTETICO"


@contextmanager
def _sesion_admin_temporal():
    """Sesión de solo lectura con el rol RLS elevado a ADMIN.

    `PriceHistory` quedó con RLS "solo ADMIN" como placeholder de seguridad
    hasta que se implementara esta épica (ver migración 2026-09-06). Entrenar
    el modelo necesita leer el historial completo sin importar qué pasajero o
    conductor disparó la solicitud que llevó a entrenar/predecir, así que se
    abre una sesión aparte con el rol elevado —nunca con un rol que vino de un
    usuario final— solo para esta lectura interna de solo lectura.
    """
    sesion = SessionLocal()
    sesion.info["rls_role"] = "ADMIN"
    try:
        yield sesion
    finally:
        sesion.close()


def _contar_historial_real() -> int:
    with _sesion_admin_temporal() as sesion:
        return sesion.query(func.count(models.PriceHistory.history_id)).scalar() or 0


def _cargar_historial_real() -> "pd.DataFrame":
    import pandas as pd  # import local: evita cargar pandas si nunca hace falta

    with _sesion_admin_temporal() as sesion:
        filas = sesion.query(models.PriceHistory).all()

    return pd.DataFrame([{
        "vehicle_category": fila.vehicle_category,
        "tipo_via": fila.tipo_via or "PAVIMENTADA",
        "distance_km": float(fila.distance_km),
        "tolls_cost": float(fila.tolls_cost or 0),
        "wait_time_hours": float(fila.wait_time_hours or 0),
        "num_days": fila.num_days or 1,
        "is_peak_hour": bool(fila.is_peak_hour),
        "is_high_season": bool(fila.is_high_season),
        "has_ac": bool(fila.has_ac),
        "has_wifi": bool(fila.has_wifi),
        "num_passengers": fila.num_passengers,
        "final_price": float(fila.final_price if fila.final_price is not None else fila.suggested_price),
    } for fila in filas])


def _obtener_modelo(forzar_reentrenamiento: bool = False) -> tuple[ModeloPrecioSugerido | None, str]:
    """Devuelve (modelo_entrenado_o_None, fuente). `fuente` es "REAL" cuando
    hay suficiente historial real (`MINIMO_MUESTRAS_REALES_PARA_ML`), o
    "SINTETICO" cuando todavía se está en cold start. El modelo es None solo
    si algo falla al entrenar (nunca debería pasar con el dataset sintético,
    que siempre existe)."""
    global _modelo_cache, _fuente_modelo_cache

    num_reales = _contar_historial_real()
    fuente = "REAL" if num_reales >= k.MINIMO_MUESTRAS_REALES_PARA_ML else "SINTETICO"

    if _modelo_cache is not None and _fuente_modelo_cache == fuente and not forzar_reentrenamiento:
        return _modelo_cache, fuente

    try:
        df = _cargar_historial_real() if fuente == "REAL" else generar_dataset_sintetico()
        modelo = ModeloPrecioSugerido().fit(df)
        _modelo_cache, _fuente_modelo_cache = modelo, fuente
        logger.info("Modelo de precio sugerido entrenado con %d muestras (%s).", len(df), fuente)
        return modelo, fuente
    except Exception:
        logger.exception("No se pudo entrenar el modelo de precio sugerido; se usará solo la fórmula de reglas.")
        return None, fuente


def _escalar_desglose(regla: ResultadoPrecio, nuevo_total: float) -> list[ComponentePrecio]:
    """Reescala cada línea del desglose de reglas para que sumen exactamente
    `nuevo_total` (el precio que dio el modelo de ML), en vez de mostrar un
    desglose que no cuadra con el número final."""
    total_reglas = sum(c.monto for c in regla.desglose) or 1.0
    factor = nuevo_total / total_reglas
    return [ComponentePrecio(c.concepto, c.monto * factor) for c in regla.desglose]


def aplica_ida_y_vuelta(ida_y_vuelta: bool, num_dias: int) -> bool:
    """El recargo de ida y vuelta es solo para viajes de un día: los de varios
    días ya se cobran por día (HU60)."""
    return bool(ida_y_vuelta) and (num_dias or 1) <= 1


def _aplicar_ida_y_vuelta(base: ResultadoPrecio, datos: PricingInput) -> ResultadoPrecio:
    """SCRUM-256 — el precio de solo ida ya incluye que el vehículo vuelve
    (distancia y peajes ×2); en ida y vuelta además vuelve con pasajeros, y se
    cobra con la proporción de la planilla del Ministerio."""
    if not aplica_ida_y_vuelta(datos.ida_y_vuelta, datos.num_dias):
        return base
    factor = factor_ida_y_vuelta(datos.num_pasajeros)
    porcentaje = round((factor - 1) * 100)
    recargo = base.precio_sugerido * (factor - 1)
    total = base.precio_sugerido + recargo
    return replace(
        base,
        precio_sugerido=total,
        precio_minimo=total * k.FACTOR_PRECIO_MINIMO,
        precio_maximo=total * k.FACTOR_PRECIO_MAXIMO,
        precio_por_persona=total / max(datos.num_pasajeros, 1),
        desglose=[*base.desglose, ComponentePrecio(f"Ida y vuelta: regreso con pasajeros (+{porcentaje}%)", recargo)],
        explicacion=(f"{base.explicacion} Ida y vuelta: +{porcentaje}% sobre el precio de solo ida, "
                     f"según la tabla de tarifas del Ministerio."),
    )


def obtener_precio_sugerido(datos: PricingInput, forzar_reentrenamiento: bool = False) -> ResultadoPrecio:
    """Punto de entrada principal: precio sugerido para un viaje.

    Siempre calcula primero la fórmula de reglas (rápida, determinista, sirve
    de piso de sensatez) y luego intenta mejorarla con el modelo de ML. Si el
    modelo todavía está en cold start (dataset sintético) o su predicción se
    desvía demasiado de lo razonable, se acota contra la fórmula de reglas
    para que nunca se sugiera un precio absurdo.

    Fórmula y modelo calculan el precio de SOLO IDA (el modelo no conoce el
    tipo de viaje y el historial se guarda en esa misma unidad, ver
    registrar_resultado_viaje); el recargo de ida y vuelta se aplica al final.
    """
    solo_ida = replace(datos, ida_y_vuelta=False)
    regla = calcular_precio_reglas(solo_ida)

    # SCRUM-257 — la tarifa exacta de la planilla para ese destino es la
    # referencia oficial: el modelo (que no conoce destinos) no la corrige.
    if regla.fuente.startswith("REFERENCIA"):
        return _aplicar_ida_y_vuelta(regla, datos)

    modelo, fuente = _obtener_modelo(forzar_reentrenamiento)

    if modelo is None:
        return _aplicar_ida_y_vuelta(regla, datos)

    f = construir_features(solo_ida)
    try:
        prediccion_ml = modelo.predict_one(solo_ida, f)
    except Exception:
        logger.exception("Predicción del modelo de ML falló; se usa la fórmula de reglas.")
        return _aplicar_ida_y_vuelta(regla, datos)

    # Banda de seguridad: con dataset sintético (que sale de la propia fórmula
    # de reglas) cualquier desviación grande es ruido de sobreajuste, no
    # señal — se acota fuerte. Con datos reales confiamos más en el modelo,
    # pero igual con un piso/techo generoso para blindarnos de una
    # extrapolación mala del modelo lineal en un caso raro.
    banda = 0.20 if fuente == "SINTETICO" else 0.40
    piso, techo = regla.precio_sugerido * (1 - banda), regla.precio_sugerido * (1 + banda)
    precio_final = min(max(prediccion_ml, piso), techo)

    desglose_ajustado = _escalar_desglose(regla, precio_final)
    explicacion = (
        f"{regla.explicacion} Precio ajustado con el modelo de Machine Learning "
        f"({'entrenado con historial real de viajes' if fuente == 'REAL' else 'en calibración inicial, sin historial real suficiente todavía'})."
    )

    return _aplicar_ida_y_vuelta(replace(
        regla,
        precio_sugerido=precio_final,
        precio_minimo=precio_final * k.FACTOR_PRECIO_MINIMO,
        precio_maximo=precio_final * k.FACTOR_PRECIO_MAXIMO,
        precio_por_persona=precio_final / max(datos.num_pasajeros, 1),
        fuente=f"ML ({fuente.lower()})",
        desglose=desglose_ajustado,
        explicacion=explicacion,
    ), datos)


def registrar_resultado_viaje(
    db: Session,
    *,
    request_id: int | None,
    vehicle_category: str,
    distance_km: float,
    suggested_price: float,
    final_price: float,
    tolls_cost: float = 0,
    wait_time_hours: float = 0,
    num_days: int = 1,
    is_peak_hour: bool = False,
    is_high_season: bool = False,
    tipo_via: str = "PAVIMENTADA",
    has_ac: bool = False,
    has_wifi: bool = False,
    num_passengers: int,
    origin_city: str | None = None,
    destination_city: str | None = None,
    ida_y_vuelta: bool = False,
) -> models.PriceHistory:
    """Guarda el resultado real de un viaje completado en `PriceHistory`, con
    la sesión normal de la request (la política RLS de INSERT permite a
    cualquier usuario autenticado registrar esto — ver migración
    2026-09-15_rls_price_history_epica12.sql). Este es el mecanismo por el
    que el histórico real crece solo, viaje a viaje, hasta superar
    `MINIMO_MUESTRAS_REALES_PARA_ML` y que el modelo deje de depender del
    dataset sintético.

    Los precios se guardan en unidades de SOLO IDA (el modelo no conoce el
    tipo de viaje): a un ida y vuelta se le quita el recargo de SCRUM-256.
    """
    if aplica_ida_y_vuelta(ida_y_vuelta, num_days):
        factor = factor_ida_y_vuelta(num_passengers)
        suggested_price /= factor
        final_price /= factor
    fila = models.PriceHistory(
        request_id=request_id,
        vehicle_category=vehicle_category,
        distance_km=distance_km,
        suggested_price=suggested_price,
        final_price=final_price,
        tolls_cost=tolls_cost,
        wait_time_hours=wait_time_hours,
        num_days=num_days,
        is_peak_hour=is_peak_hour,
        is_high_season=is_high_season,
        tipo_via=tipo_via,
        has_ac=has_ac,
        has_wifi=has_wifi,
        num_passengers=num_passengers,
        origin_city=(origin_city or "")[:100] or None,
        destination_city=(destination_city or "")[:100] or None,
    )
    db.add(fila)
    db.commit()
    db.refresh(fila)
    return fila
