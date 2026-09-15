"""
Modelo de Machine Learning — HU29: "regresión lineal múltiple entrenada con
datos históricos de viajes (tabla PriceHistory): distancia, peajes, tiempo de
espera, número de días, hora pico, temporada alta, tipo de vía y comodidades
como variables".

Envuelve un `sklearn.Pipeline` (codificación one-hot de las variables
categóricas + regresión lineal) para poder guardarlo/cargarlo como un único
objeto con `joblib`, y para que el mismo pipeline se use tanto al entrenar
como al predecir (evita el error clásico de codificar distinto en cada lado).
"""
from __future__ import annotations

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LinearRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from .features import PricingInput

COLUMNAS_CATEGORICAS = ["vehicle_category", "tipo_via"]
COLUMNAS_NUMERICAS = [
    "distance_km", "tolls_cost", "wait_time_hours", "num_days",
    "is_peak_hour", "is_high_season", "has_ac", "has_wifi", "num_passengers",
]
COLUMNA_OBJETIVO = "final_price"


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
        faltantes = set(COLUMNAS_CATEGORICAS + COLUMNAS_NUMERICAS + [COLUMNA_OBJETIVO]) - set(df.columns)
        if faltantes:
            raise ValueError(f"Al dataset de entrenamiento le faltan columnas: {faltantes}")

        df = df.copy()
        for col in ("is_peak_hour", "is_high_season", "has_ac", "has_wifi"):
            df[col] = df[col].astype(int)

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
