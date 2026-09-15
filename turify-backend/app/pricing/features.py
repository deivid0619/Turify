"""
Ingeniería de variables del motor de precio — punto de entrada único que usan
tanto `rules_engine.py` (fórmula de respaldo) como `ml_model.py` (regresión),
para que las dos formas de calcular el precio partan exactamente de los
mismos números y nunca se desalineen entre sí.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from . import constants as k
from .holidays_co import es_temporada_alta
from .vehicle_categories import tarifa_base_km


@dataclass
class PricingInput:
    """Todo lo que hace falta para sugerir un precio.

    Los campos `*_override` son opcionales: se usan cuando ya se conoce el
    vehículo/conductor concreto (tiene sus propias tarifas configuradas en
    HU55). En la vista previa "antes de publicar el viaje" (HU28) todavía no
    hay conductor asignado, así que se dejan en None y el motor usa las
    tarifas base por defecto de la categoría.
    """

    distancia_km: float
    categoria_vehiculo: str
    num_adultos: int
    fecha_salida: datetime
    num_ninos: int = 0
    # Menores de 2 años no cuentan como pasajero (HU29) — se reciben aparte
    # únicamente para no perder el dato, no afectan capacidad ni precio.
    num_infantes: int = 0
    ida_y_vuelta: bool = False
    tolls_cost: float = 0.0
    tiempo_espera_horas: float = 0.0
    num_dias: int = 1
    tipo_via: str = "PAVIMENTADA"
    km_paradas_intermedias: float = 0.0
    comodidades: dict = field(default_factory=dict)

    tarifa_km_base_override: float | None = None
    tarifa_espera_hora_override: float | None = None
    tarifa_dia_override: float | None = None
    km_incluidos_por_dia_override: int | None = None
    recargo_dificil_acceso_override: float | None = None

    @property
    def num_pasajeros(self) -> int:
        """Pasajeros que cuentan para capacidad y precio por persona."""
        return self.num_adultos + self.num_ninos


def construir_features(datos: PricingInput) -> dict:
    """Convierte un `PricingInput` en el diccionario de variables que consumen
    la fórmula de reglas y el modelo de ML."""

    hora = datos.fecha_salida.hour
    es_nocturno = hora >= k.HORA_INICIO_RECARGO_NOCTURNO or hora < k.HORA_FIN_RECARGO_NOCTURNO

    temporada = es_temporada_alta(datos.fecha_salida.date())

    tarifa_km_base = datos.tarifa_km_base_override or tarifa_base_km(datos.categoria_vehiculo)
    # Heurística de respaldo para la tarifa de espera cuando todavía no hay un
    # conductor concreto asignado (no hay HU que fije un valor único): se
    # ancla a la tarifa por km de la categoría, igual que se ancla el resto de
    # la fórmula, en vez de un número mágico fijo para todas las categorías.
    tarifa_espera_hora = datos.tarifa_espera_hora_override or (tarifa_km_base * 10)
    tarifa_dia = datos.tarifa_dia_override or (tarifa_km_base * 150)
    km_incluidos_por_dia = datos.km_incluidos_por_dia_override or k.KM_INCLUIDOS_POR_DIA_DEFECTO
    recargo_dificil_acceso = (
        datos.recargo_dificil_acceso_override
        if datos.recargo_dificil_acceso_override is not None
        else k.RECARGO_VIA_DESTAPADA
    )

    distancia_total_km = datos.distancia_km + datos.km_paradas_intermedias

    # HU60 — viajes de varios días: los primeros `km_incluidos_por_dia * num_dias`
    # van dentro de la tarifa diaria, el resto se cobra como km extra.
    km_incluidos_totales = km_incluidos_por_dia * datos.num_dias
    km_extra_multidia = max(0.0, distancia_total_km - km_incluidos_totales) if datos.num_dias > 1 else 0.0
    km_facturables_normal = distancia_total_km if datos.num_dias <= 1 else 0.0

    recargo_via = {
        "PAVIMENTADA": 0.0,
        "MIXTA": k.RECARGO_VIA_MIXTA,
        "DESTAPADA": recargo_dificil_acceso,
    }.get(datos.tipo_via, 0.0)

    num_comodidades = sum(1 for v in datos.comodidades.values() if v)
    recargo_comodidades = min(k.MAXIMO_RECARGO_COMODIDADES, num_comodidades * k.RECARGO_POR_COMODIDAD)

    tolls_total = datos.tolls_cost * (2 if datos.ida_y_vuelta else 1)

    return {
        "distancia_km": datos.distancia_km,
        "distancia_total_km": distancia_total_km,
        "categoria_vehiculo": datos.categoria_vehiculo,
        "num_pasajeros": datos.num_pasajeros,
        "tipo_via": datos.tipo_via,
        "num_dias": datos.num_dias,
        "tiempo_espera_horas": datos.tiempo_espera_horas,
        "tolls_cost": datos.tolls_cost,
        "tolls_total": tolls_total,
        "es_nocturno": es_nocturno,
        "es_temporada_alta": temporada["es_temporada_alta"],
        "motivo_temporada_alta": temporada["motivo"],
        "num_comodidades": num_comodidades,
        "recargo_comodidades": recargo_comodidades,
        "recargo_via": recargo_via,
        "tarifa_km_base": tarifa_km_base,
        "tarifa_espera_hora": tarifa_espera_hora,
        "tarifa_dia": tarifa_dia,
        "km_incluidos_por_dia": km_incluidos_por_dia,
        "km_extra_multidia": km_extra_multidia,
        "km_facturables_normal": km_facturables_normal,
    }
