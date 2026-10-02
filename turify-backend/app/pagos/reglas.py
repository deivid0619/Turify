"""Reglas del dinero de un viaje, sin base de datos (SCRUM-178).

Recorrido acordado con David el 25 sep 2026:

    Ida y vuelta: 20 % anticipo al confirmar · 50 % al llegar al destino ·
                  30 % cuando los recoge para el regreso
    Solo ida:     30 % anticipo al confirmar · 70 % al dejarlos en el destino

Cuadra con la tabla del Ministerio (solo ida ≈ 70 % de ida y vuelta): si
alguien falla en el regreso, lo ya pagado equivale a un viaje de solo ida.
"""
import logging
import os
from decimal import Decimal, ROUND_HALF_UP

logger = logging.getLogger("turify.pagos")

HITOS_IDA_Y_VUELTA = (
    ("ANTICIPO", Decimal("20")),
    ("LLEGADA_DESTINO", Decimal("50")),
    ("RECOGIDA_REGRESO", Decimal("30")),
)
HITOS_SOLO_IDA = (
    ("ANTICIPO", Decimal("30")),
    ("LLEGADA_DESTINO", Decimal("70")),
)

# SCRUM-181 — con 24 h o más de anticipación el pasajero cancela gratis; con
# menos, pierde el anticipo (queda para el conductor como compensación).
HORAS_CANCELACION_LIBRE = 24

# SCRUM-259 — intentos del código de abordaje antes de bloquearlo un rato.
MAX_INTENTOS_CODIGO = 5
MINUTOS_BLOQUEO_CODIGO = 15

# Mientras Wompi no esté integrado (SCRUM-179), el anticipo también se le
# paga directo al conductor. Cuando esté, esto pasa a 'APP'.
CANAL_ANTICIPO = "DIRECTO"

COMISION_POR_DEFECTO = Decimal("10")


def hitos_para(ida_y_vuelta: bool):
    return HITOS_IDA_Y_VUELTA if ida_y_vuelta else HITOS_SOLO_IDA


def repartir(precio_total, hitos):
    """[(hito, porcentaje, monto)] en pesos enteros. El último pago absorbe el
    redondeo, así la suma siempre da exacto el precio acordado."""
    total = Decimal(str(precio_total)).quantize(Decimal("1"), ROUND_HALF_UP)
    reparto = []
    acumulado = Decimal("0")
    for i, (hito, porcentaje) in enumerate(hitos):
        if i == len(hitos) - 1:
            monto = total - acumulado
        else:
            monto = (total * porcentaje / 100).quantize(Decimal("1"), ROUND_HALF_UP)
            acumulado += monto
        reparto.append((hito, porcentaje, monto))
    return reparto


def comision_vigente(canal: str):
    """(porcentaje, motivo) de la comisión de Turify para un viaje que se
    confirma hoy (SCRUM-261).

    La comisión se descuenta del anticipo, así que solo existe si el anticipo
    pasa por la app: pagado directo al conductor, Turify no tiene de dónde
    descontarla. (El periodo de lanzamiento sin comisión se retiró el 27 sep
    2026: David decidió no implementarlo por ahora.)
    """
    if canal != "APP":
        return Decimal("0"), "SIN_PASARELA"

    try:
        porcentaje = Decimal(os.getenv("COMISION_TURIFY_PCT", str(COMISION_POR_DEFECTO)))
    except ArithmeticError:
        logger.warning("COMISION_TURIFY_PCT no es un número; se usa %s %%", COMISION_POR_DEFECTO)
        porcentaje = COMISION_POR_DEFECTO
    return porcentaje, "NORMAL"


def calcular_comision(precio_total, porcentaje, tope):
    """Comisión en pesos enteros, nunca mayor que el anticipo del que sale."""
    bruta = Decimal(str(precio_total)) * Decimal(porcentaje) / 100
    comision = Decimal(bruta).quantize(Decimal("1"), ROUND_HALF_UP)
    if comision > tope:
        logger.warning("La comisión (%s) supera el anticipo (%s); se limita al anticipo.", comision, tope)
        return Decimal(tope)
    return comision
