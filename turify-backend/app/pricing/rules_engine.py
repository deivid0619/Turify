"""
Fórmula de reglas — respaldo determinista del motor de precio (HU29).

Se usa siempre que no hay suficiente historial real para el modelo de ML
("cold start", ver `constants.MINIMO_MUESTRAS_REALES_PARA_ML`) y como techo de
sensatez para acotar cualquier predicción del modelo (ver `service.py`), para
que un modelo mal entrenado nunca pueda sugerir un precio absurdo.

Implementa uno a uno los criterios de aceptación de la HU29:
  * Precio siempre por vehículo completo, nunca por pasajero.
  * Recargo nocturno del 20% (9pm-5am).
  * Recargo por temporada alta.
  * Recargo por vía difícil (mixta/destapada).
  * Tiempo de espera cobrado por hora.
  * Viajes de varios días: tarifa_dia + km extra.
  * Peajes y distancia siempre incluyen el regreso del vehículo, así el
    pasajero haya pedido solo ida (ver `features.py`).
"""
from __future__ import annotations

from . import constants as k
from .features import PricingInput, construir_features
from .resultado import ComponentePrecio, ResultadoPrecio
from .vehicle_categories import sugerir_categoria_para_pasajeros


def calcular_precio_reglas(datos: PricingInput) -> ResultadoPrecio:
    f = construir_features(datos)
    desglose: list[ComponentePrecio] = []

    # ── Base por distancia (o por día, en viajes multidía) ──────────────────
    if datos.num_dias <= 1:
        base_distancia = f["km_facturables_normal"] * f["tarifa_km_base"]
        desglose.append(ComponentePrecio(
            f"Distancia: {f['distancia_ida_km']:.1f} km de ida + regreso del vehículo "
            f"({f['distancia_total_km']:.1f} km x ${f['tarifa_km_base']:.0f}/km)",
            base_distancia,
        ))
    else:
        base_dias = f["tarifa_dia"] * datos.num_dias
        desglose.append(ComponentePrecio(
            f"Tarifa por {datos.num_dias} día(s) (${f['tarifa_dia']:.0f}/día, {f['km_incluidos_por_dia']} km/día incluidos)",
            base_dias,
        ))
        base_distancia = base_dias
        if f["km_extra_multidia"] > 0:
            extra = f["km_extra_multidia"] * f["tarifa_km_base"]
            desglose.append(ComponentePrecio(
                f"Km adicionales ({f['km_extra_multidia']:.1f} km x ${f['tarifa_km_base']:.0f}/km)",
                extra,
            ))
            base_distancia += extra

    subtotal = base_distancia

    # ── Espera ───────────────────────────────────────────────────────────────
    if datos.tiempo_espera_horas > 0:
        monto_espera = datos.tiempo_espera_horas * f["tarifa_espera_hora"]
        desglose.append(ComponentePrecio(
            f"Tiempo de espera ({datos.tiempo_espera_horas:.1f} h)", monto_espera,
        ))
        subtotal += monto_espera

    # ── Peajes ───────────────────────────────────────────────────────────────
    if f["tolls_total"] > 0:
        desglose.append(ComponentePrecio("Peajes (ida y regreso del vehículo)", f["tolls_total"]))
        subtotal += f["tolls_total"]

    # ── Recargos porcentuales sobre el subtotal ─────────────────────────────
    if f["recargo_via"] > 0:
        monto = subtotal * f["recargo_via"]
        etiqueta = "Recargo vía destapada" if datos.tipo_via == "DESTAPADA" else "Recargo vía mixta"
        desglose.append(ComponentePrecio(f"{etiqueta} (+{f['recargo_via']*100:.0f}%)", monto))
        subtotal += monto

    if f["es_nocturno"]:
        monto = subtotal * k.RECARGO_NOCTURNO
        desglose.append(ComponentePrecio(f"Recargo nocturno (+{k.RECARGO_NOCTURNO*100:.0f}%)", monto))
        subtotal += monto

    if f["es_temporada_alta"]:
        monto = subtotal * k.RECARGO_TEMPORADA_ALTA
        desglose.append(ComponentePrecio(
            f"Recargo temporada alta: {f['motivo_temporada_alta']} (+{k.RECARGO_TEMPORADA_ALTA*100:.0f}%)",
            monto,
        ))
        subtotal += monto

    if f["recargo_comodidades"] > 0:
        monto = subtotal * f["recargo_comodidades"]
        desglose.append(ComponentePrecio(
            f"Comodidades del vehículo (+{f['recargo_comodidades']*100:.0f}%)", monto,
        ))
        subtotal += monto

    precio_total = max(subtotal, 0.0)
    precio_por_persona = precio_total / max(datos.num_pasajeros, 1)

    sugerencia_capacidad = sugerir_categoria_para_pasajeros(datos.num_pasajeros)

    return ResultadoPrecio(
        precio_sugerido=precio_total,
        precio_minimo=precio_total * k.FACTOR_PRECIO_MINIMO,
        precio_maximo=precio_total * k.FACTOR_PRECIO_MAXIMO,
        precio_por_persona=precio_por_persona,
        fuente="REGLAS",
        desglose=desglose,
        explicacion=_explicacion(datos, f, precio_total),
        es_nocturno=f["es_nocturno"],
        es_temporada_alta=f["es_temporada_alta"],
        motivo_temporada_alta=f["motivo_temporada_alta"],
        categoria_vehiculo=datos.categoria_vehiculo,
        excede_capacidad_maxima=sugerencia_capacidad["excede_capacidad_maxima"],
    )


def _explicacion(datos: PricingInput, f: dict, precio_total: float) -> str:
    """Explicación en lenguaje natural del precio (HU29: "explicación en
    lenguaje natural con desglose detallado, mostrando los factores que
    influenciaron el precio")."""
    nombre_categoria = datos.categoria_vehiculo.replace("_", " ").title()
    partes = [
        f"Precio calculado para un vehículo tipo {nombre_categoria}: "
        f"{f['distancia_ida_km']:.1f} km de ida, {f['distancia_total_km']:.1f} km en total "
        f"(el conductor tiene que volver, así el viaje sea solo de ida)."
    ]
    factores = []
    if f["es_nocturno"]:
        factores.append("horario nocturno")
    if f["es_temporada_alta"]:
        factores.append(f"temporada alta ({f['motivo_temporada_alta']})")
    if datos.tipo_via != "PAVIMENTADA":
        factores.append("vía de difícil acceso")
    if f["tolls_total"] > 0:
        factores.append("peajes en la ruta")
    if datos.tiempo_espera_horas > 0:
        factores.append("tiempo de espera")
    if datos.num_dias > 1:
        factores.append(f"viaje de {datos.num_dias} días")
    if factores:
        partes.append("Incluye recargo por: " + ", ".join(factores) + ".")
    partes.append(
        f"Precio por persona: ${precio_total / max(datos.num_pasajeros, 1):,.0f} "
        f"({datos.num_pasajeros} pasajero(s))."
    )
    return " ".join(partes)
