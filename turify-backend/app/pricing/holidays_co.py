"""
Detección de temporada alta — HU29 / HU58.

Combina:
  * Festivos oficiales de Colombia (incluye los que se recorren al lunes por
    la Ley Emiliani, y Jueves/Viernes Santo) vía la librería `holidays`.
  * Un "puente": el día antes de un festivo que cae lunes también cuenta como
    temporada alta, porque en la práctica el viaje de ida ya es de temporada
    alta aunque el festivo en sí sea el lunes.
  * Ventanas fijas que NO son festivo oficial pero sí temporada alta real de
    transporte en Antioquia: Feria de las Flores (Medellín, primeros días de
    agosto) y fin de año (mediados de diciembre a mediados de enero).

HU58 pide una "base de datos de festivos... actualizada anualmente": al
apoyarnos en la librería `holidays` (que ya sabe calcular Semana Santa y la
Ley Emiliani para cualquier año) casi no hay nada que mantener a mano salvo
las dos ventanas fijas de abajo.
"""
from __future__ import annotations

from datetime import date, timedelta
from functools import lru_cache

import holidays as holidays_lib

# Ventanas de temporada alta que no son festivo oficial. (mes_inicio, dia_inicio,
# mes_fin, dia_fin) — se evalúan sobre el año del viaje, sin cruzar fin de año
# salvo la de diciembre/enero, que se maneja aparte.
_FERIA_DE_LAS_FLORES = ((8, 1), (8, 10))       # Medellín — primeros días de agosto
_TEMPORADA_FIN_DE_ANO = ((12, 15), (1, 15))    # cruza el 31 de diciembre


@lru_cache(maxsize=8)
def _festivos_colombia(anio: int):
    """Festivos oficiales de Colombia para un año (y el anterior/siguiente,
    para poder resolver rangos que cruzan el 31 de diciembre)."""
    return holidays_lib.country_holidays("CO", years=[anio - 1, anio, anio + 1])


def _en_ventana_fija(fecha: date, inicio: tuple, fin: tuple) -> bool:
    (mi, di), (mf, df) = inicio, fin
    if (mi, di) <= (mf, df):
        return (mi, di) <= (fecha.month, fecha.day) <= (mf, df)
    # La ventana cruza el fin de año (ej. diciembre -> enero)
    return (fecha.month, fecha.day) >= (mi, di) or (fecha.month, fecha.day) <= (mf, df)


def es_temporada_alta(fecha: date) -> dict:
    """Indica si `fecha` cae en temporada alta y por qué.

    Devuelve {"es_temporada_alta": bool, "motivo": str | None}.
    """
    festivos = _festivos_colombia(fecha.year)

    if fecha in festivos:
        return {"es_temporada_alta": True, "motivo": f"Festivo: {festivos[fecha]}"}

    # Puente: el día antes de un festivo que cae lunes.
    siguiente = fecha + timedelta(days=1)
    if siguiente.weekday() == 0 and siguiente in festivos:
        return {"es_temporada_alta": True, "motivo": f"Puente antes de {festivos[siguiente]}"}

    if _en_ventana_fija(fecha, *_FERIA_DE_LAS_FLORES):
        return {"es_temporada_alta": True, "motivo": "Feria de las Flores"}

    if _en_ventana_fija(fecha, *_TEMPORADA_FIN_DE_ANO):
        return {"es_temporada_alta": True, "motivo": "Temporada de fin de año"}

    return {"es_temporada_alta": False, "motivo": None}
