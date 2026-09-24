"""
Modelo de Machine Learning — HU29: "regresión lineal múltiple entrenada con
datos históricos de viajes (tabla PriceHistory): distancia, peajes, tiempo de
espera, número de días, hora pico, temporada alta, tipo de vía y comodidades
como variables".

Envuelve un `sklearn.Pipeline` (codificación one-hot de las variables
categóricas + regresión lineal) para poder guardarlo/cargarlo como un único
objeto con `joblib`, y para que el mismo pipeline se use tanto al entrenar
como al predecir (evita el error clásico de codificar distinto en cada lado).

Interacción categoría x variable continua
------------------------------------------
La tarifa real NO es aditiva por categoría: un Bus Ejecutivo no cuesta "un
monto fijo más" que un Sedán, cuesta varias veces más *por km* (9.000 vs
1.500 COP/km, ver `vehicle_categories.TARIFA_BASE_KM_SUGERIDO`). Un modelo
lineal con la categoría codificada en one-hot y `distance_km` como columna
compartida solo puede aprender UNA pendiente para todas las categorías a la
vez (la categoría únicamente desplaza el intercepto hacia arriba/abajo) —
matemáticamente no puede representar "el precio sube 6 veces más rápido por
km en un Bus Ejecutivo que en un Sedán". El síntoma real de esto: entrenado
así, el modelo predecía precios absurdos (incluso negativos, recortados a 0)
para categorías alejadas del promedio de la mezcla de entrenamiento.

La solución es la de siempre en regresión lineal para permitir una pendiente
distinta por grupo: expandir cada variable continua "escalada por categoría"
(distancia, tiempo de espera, días) en una columna por categoría que vale la
variable original dentro de esa categoría y 0 fuera de ella — así cada
categoría obtiene su propio coeficiente de km, de hora de espera y de día.
"""
from __future__ import annotations

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LinearRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from .features import PricingInput
from .vehicle_categories import CATEGORIAS_EN_ORDEN

COLUMNAS_CATEGORICAS = ["vehicle_category", "tipo_via"]

# Variables cuyo efecto en el precio depende fuertemente de la categoría del
# vehículo (todas escalan con la tarifa base por km, ver rules_engine.py) —
# se expanden en una columna por categoría en `_expandir_interacciones`.
VARIABLES_ESCALADAS_POR_CATEGORIA = ["distance_km", "wait_time_hours", "num_days"]

# El resto de variables afecta el precio como un monto o un recargo
# porcentual parejo, sin depender de qué tan grande es el vehículo.
COLUMNAS_NUMERICAS_PLANAS = ["tolls_cost", "is_peak_hour", "is_high_season", "has_ac", "has_wifi", "num_passengers"]

COLUMNAS_INTERACCION = [
    f"{variable}__{categoria}"
    for variable in VARIABLES_ESCALADAS_POR_CATEGORIA
    for categoria in CATEGORIAS_EN_ORDEN
]
COLUMNAS_NUMERICAS = COLUMNAS_NUMERICAS_PLANAS + COLUMNAS_INTERACCION

COLUMNA_OBJETIVO = "final_price"


def _expandir_interacciones(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    for variable in VARIABLES_ESCALADAS_POR_CATEGORIA:
        for categoria in CATEGORIAS_EN_ORDEN:
            pertenece = (df["vehicle_category"] == categoria).astype(float)
            df[f"{variable}__{categoria}"] = df[variable] * pertenece
    return df


def _construir_pipeline() -> Pipeline:
    preprocesador = ColumnTransformer(transformers=[
        ("categoricas", OneHotEncoder(handle_unknown="ignore"), COLUMNAS_CATEGORICAS),
        ("numericas", "passthrough", COLUMNAS_NUMERICAS),
    ])
    return Pipeline(steps=[
        ("preprocesador", preprocesador),
        ("regresion", LinearRegression()),
    ])


class ModeloPrecioSugerido:
    """Regresión lineal múltiple para el precio sugerido de un viaje."""

    def __init__(self):
        self._pipeline: Pipeline = _construir_pipeline()
        self.entrenado = False
        self.num_muestras_entrenamiento = 0

    def fit(self, df: pd.DataFrame) -> "ModeloPrecioSugerido":
        requeridas = set(COLUMNAS_CATEGORICAS + COLUMNAS_NUMERICAS_PLANAS + VARIABLES_ESCALADAS_POR_CATEGORIA + [COLUMNA_OBJETIVO])
        faltantes = requeridas - set(df.columns)
        if faltantes:
            raise ValueError(f"Al dataset de entrenamiento le faltan columnas: {faltantes}")

        df = df.copy()
        for col in ("is_peak_hour", "is_high_season", "has_ac", "has_wifi"):
            df[col] = df[col].astype(int)
        df = _expandir_interacciones(df)

        X = df[COLUMNAS_CATEGORICAS + COLUMNAS_NUMERICAS]
        y = df[COLUMNA_OBJETIVO].astype(float)

        self._pipeline.fit(X, y)
        self.entrenado = True
        self.num_muestras_entrenamiento = len(df)
        return self

    def predict_one(self, datos: PricingInput, f: dict) -> float:
        if not self.entrenado:
            raise RuntimeError("El modelo todavía no ha sido entrenado (llama a fit() primero).")

        fila = pd.DataFrame([{
            "vehicle_category": datos.categoria_vehiculo,
            "tipo_via": datos.tipo_via,
            "distance_km": f["distancia_total_km"],
            "tolls_cost": f["tolls_total"],
            "wait_time_hours": datos.tiempo_espera_horas,
            "num_days": datos.num_dias,
            "is_peak_hour": int(f["es_nocturno"]),
            "is_high_season": int(f["es_temporada_alta"]),
            "has_ac": int(bool(datos.comodidades.get("tiene_ac"))),
            "has_wifi": int(bool(datos.comodidades.get("tiene_wifi"))),
            "num_passengers": datos.num_pasajeros,
        }])
        fila = _expandir_interacciones(fila)
        prediccion = self._pipeline.predict(fila)[0]
        return max(float(prediccion), 0.0)

    def save(self, ruta: str) -> None:
        joblib.dump(self, ruta)

    @staticmethod
    def load(ruta: str) -> "ModeloPrecioSugerido":
        modelo = joblib.load(ruta)
        if not isinstance(modelo, ModeloPrecioSugerido):
            raise TypeError(f"El archivo {ruta} no contiene un ModeloPrecioSugerido.")
        return modelo
