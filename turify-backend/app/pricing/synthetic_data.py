"""
Dataset sintético de arranque ("cold start") para el modelo de ML.

SCRUM-222 se implementa con la tabla `PriceHistory` real todavía vacía (no
hay suficientes viajes completados en producción). La HU29 pide justamente
que el sistema no se quede sin poder sugerir un precio en ese caso
("fallback automático a fórmula matemática/reglas"), pero para que el
*modelo de ML* en sí mismo pueda demostrarse, probarse y quedar ya cableado
de punta a punta, generamos aquí un dataset sintético plausible:

  * Se genera 100% en memoria del proceso — NUNCA se inserta en la tabla
    PriceHistory real. Contaminar el historial real con filas falsas
    arruinaría el entrenamiento para siempre (no hay forma de "restar" ruido
    sintético de datos reales mezclados).
  * Los "precios verdaderos" de cada fila salen de `rules_engine` (la misma
    fórmula ya validada contra la HU29) más ruido gaussiano, para simular la
    variación real de precios acordados en la negociación pasajero-conductor
    alrededor de un precio justo.
  * En cuanto `PriceHistory` acumule `constants.MINIMO_MUESTRAS_REALES_PARA_ML`
    filas reales, `service.py` deja de usar este dataset y entrena solo con
    datos reales — ver `service.py::_debe_usar_ml`.
"""
from __future__ import annotations

from datetime import datetime, timezone

import numpy as np
import pandas as pd

from . import constants as k
from .features import PricingInput, construir_features
from .rules_engine import calcular_precio_reglas
from .vehicle_categories import CATEGORIAS_EN_ORDEN

_RUIDO_RELATIVO = 0.08  # desviación estándar del ruido, como fracción del precio


def generar_dataset_sintetico(semilla: int = 42) -> pd.DataFrame:
    """Genera `MUESTRAS_SINTETICAS_POR_CATEGORIA` filas por categoría de
    vehículo, cubriendo un rango amplio y aleatorio de distancias, horarios,
    tipos de vía, comodidades y temporadas — para que el modelo vea variación
    real en cada variable de entrada."""
    rng = np.random.default_rng(semilla)
    filas = []

    fechas_diurnas = [datetime(2026, 3, 10, 10, tzinfo=timezone.utc)]   # normal
    fechas_nocturnas = [datetime(2026, 3, 10, 22, tzinfo=timezone.utc)]  # recargo nocturno
    fechas_temporada_alta = [datetime(2026, 12, 24, 10, tzinfo=timezone.utc)]  # fin de año

    for categoria in CATEGORIAS_EN_ORDEN:
        for _ in range(k.MUESTRAS_SINTETICAS_POR_CATEGORIA):
            distancia_km = float(rng.uniform(3, 300))
            tipo_via = rng.choice(["PAVIMENTADA", "PAVIMENTADA", "MIXTA", "DESTAPADA"])  # mayoría pavimentada
            tolls_cost = float(rng.choice([0, 0, 8000, 15000, 25000]))
            tiempo_espera_horas = float(rng.choice([0, 0, 0, 0.5, 1, 2]))
            num_dias = int(rng.choice([1, 1, 1, 1, 2, 3]))
            ida_y_vuelta = bool(rng.choice([True, False]))

            momento = rng.choice(["diurno", "diurno", "diurno", "nocturno", "temporada_alta"])
            if momento == "nocturno":
                fecha = fechas_nocturnas[0]
            elif momento == "temporada_alta":
                fecha = fechas_temporada_alta[0]
            else:
                fecha = fechas_diurnas[0]

            comodidades = {
                "tiene_ac": bool(rng.choice([True, False])),
                "tiene_wifi": bool(rng.choice([True, False])),
                "tiene_bano": bool(rng.choice([True, False, False])),
            }

            entrada = PricingInput(
                distancia_km=distancia_km,
                categoria_vehiculo=categoria,
                num_adultos=int(rng.integers(1, 6)),
                num_ninos=int(rng.integers(0, 3)),
                fecha_salida=fecha,
                ida_y_vuelta=ida_y_vuelta,
                tolls_cost=tolls_cost,
                tiempo_espera_horas=tiempo_espera_horas,
                num_dias=num_dias,
                tipo_via=tipo_via,
                comodidades=comodidades,
            )
            resultado = calcular_precio_reglas(entrada)
            precio_con_ruido = max(
                resultado.precio_sugerido * float(rng.normal(1.0, _RUIDO_RELATIVO)),
                0.0,
            )
            f = construir_features(entrada)

            filas.append({
                "vehicle_category": categoria,
                "distance_km": distancia_km,
                "tolls_cost": tolls_cost,
                "wait_time_hours": tiempo_espera_horas,
                "num_days": num_dias,
                "is_peak_hour": f["es_nocturno"],
                "is_high_season": f["es_temporada_alta"],
                "tipo_via": tipo_via,
                "has_ac": comodidades["tiene_ac"],
                "has_wifi": comodidades["tiene_wifi"],
                "num_passengers": entrada.num_pasajeros,
                "final_price": precio_con_ruido,
            })

    return pd.DataFrame(filas)
