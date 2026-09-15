"""
SCRUM-222 / HU29 — Motor de precio sugerido (regresión lineal múltiple + reglas).

Cubre, en orden:
  1. Detección de temporada alta (holidays_co).
  2. Categoría de vehículo por capacidad (vehicle_categories).
  3. La fórmula de reglas contra los criterios de aceptación de la HU29, uno
     por uno (base por km, recargo nocturno, vía difícil, multidía, precio
     por persona).
  4. El dataset sintético + el modelo de ML (cold start).
  5. El endpoint HTTP /api/service-requests/price-estimate.
"""
from datetime import date, datetime, timedelta, timezone

import pytest

from app.pricing import constants as k
from app.pricing.features import PricingInput
from app.pricing.holidays_co import es_temporada_alta
from app.pricing.rules_engine import calcular_precio_reglas
from app.pricing.vehicle_categories import (
    calcular_categoria,
    sugerir_categoria_para_pasajeros,
    tarifa_base_km,
)


# ── Temporada alta ───────────────────────────────────────────────────────────

def test_navidad_es_temporada_alta():
    resultado = es_temporada_alta(date(2026, 12, 25))
    assert resultado["es_temporada_alta"] is True


def test_un_martes_cualquiera_no_es_temporada_alta():
    # 9 de junio de 2026 es martes, sin festivo ni ventana especial cerca.
    resultado = es_temporada_alta(date(2026, 6, 9))
    assert resultado["es_temporada_alta"] is False
    assert resultado["motivo"] is None


def test_feria_de_las_flores_es_temporada_alta():
    resultado = es_temporada_alta(date(2026, 8, 5))
    assert resultado["es_temporada_alta"] is True
    assert "Feria de las Flores" in resultado["motivo"]


def test_fin_de_ano_cruza_diciembre_enero():
    assert es_temporada_alta(date(2026, 12, 20))["es_temporada_alta"] is True
    assert es_temporada_alta(date(2027, 1, 5))["es_temporada_alta"] is True


# ── Categoría de vehículo ────────────────────────────────────────────────────

@pytest.mark.parametrize("capacidad,categoria_esperada", [
    (1, "SEDAN"), (4, "SEDAN"),
    (5, "VAN"), (10, "VAN"),
    (11, "MICROBUS"), (19, "MICROBUS"),
    (20, "BUS"), (35, "BUS"),
    (36, "BUS_GRANDE"), (60, "BUS_GRANDE"), (90, "BUS_GRANDE"),
])
def test_calcular_categoria_por_capacidad(capacidad, categoria_esperada):
    assert calcular_categoria(capacidad) == categoria_esperada


def test_sugerir_categoria_para_pasajeros_dentro_de_capacidad():
    sugerencia = sugerir_categoria_para_pasajeros(5)
    assert sugerencia == {"categoria": "VAN", "excede_capacidad_maxima": False}


def test_sugerir_categoria_marca_exceso_de_capacidad():
    sugerencia = sugerir_categoria_para_pasajeros(65)
    assert sugerencia["excede_capacidad_maxima"] is True


# ── Fórmula de reglas (HU29) ─────────────────────────────────────────────────

_SALIDA_DIURNA = datetime(2026, 6, 9, 10, tzinfo=timezone.utc)  # martes normal, 10am


def _entrada_base(**overrides) -> PricingInput:
    datos = dict(
        distancia_km=100,
        categoria_vehiculo="SEDAN",
        num_adultos=2,
        fecha_salida=_SALIDA_DIURNA,
    )
    datos.update(overrides)
    return PricingInput(**datos)


def test_precio_base_es_distancia_por_tarifa_de_categoria():
    resultado = calcular_precio_reglas(_entrada_base())
    esperado = 100 * tarifa_base_km("SEDAN")
    assert resultado.precio_sugerido == pytest.approx(esperado)
    assert resultado.fuente == "REGLAS"


def test_precio_nunca_es_por_pasajero_sino_por_vehiculo():
    """HU29: 'Precio siempre por vehículo completo, nunca por pasajero'."""
    con_2 = calcular_precio_reglas(_entrada_base(num_adultos=2))
    con_6 = calcular_precio_reglas(_entrada_base(num_adultos=6))
    assert con_2.precio_sugerido == pytest.approx(con_6.precio_sugerido)
    # El precio por persona sí baja al repartir entre más pasajeros.
    assert con_6.precio_por_persona < con_2.precio_por_persona


def test_ninos_menores_de_2_anos_no_cuentan_como_pasajero():
    resultado = calcular_precio_reglas(_entrada_base(num_adultos=2, num_infantes=3))
    assert resultado.precio_por_persona == pytest.approx(resultado.precio_sugerido / 2)


def test_recargo_nocturno_20_por_ciento():
    nocturno = _entrada_base(fecha_salida=datetime(2026, 6, 9, 22, tzinfo=timezone.utc))
    resultado = calcular_precio_reglas(nocturno)
    base = 100 * tarifa_base_km("SEDAN")
    assert resultado.precio_sugerido == pytest.approx(base * (1 + k.RECARGO_NOCTURNO))
    assert resultado.es_nocturno is True


def test_recargo_via_destapada_15_por_ciento():
    resultado = calcular_precio_reglas(_entrada_base(tipo_via="DESTAPADA"))
    base = 100 * tarifa_base_km("SEDAN")
    assert resultado.precio_sugerido == pytest.approx(base * (1 + k.RECARGO_VIA_DESTAPADA))


def test_recargo_temporada_alta():
    navidad = _entrada_base(fecha_salida=datetime(2026, 12, 25, 10, tzinfo=timezone.utc))
    resultado = calcular_precio_reglas(navidad)
    base = 100 * tarifa_base_km("SEDAN")
    assert resultado.precio_sugerido == pytest.approx(base * (1 + k.RECARGO_TEMPORADA_ALTA))
    assert resultado.es_temporada_alta is True


def test_peajes_se_duplican_en_ida_y_vuelta():
    solo_ida = calcular_precio_reglas(_entrada_base(tolls_cost=10_000, ida_y_vuelta=False))
    ida_y_vuelta = calcular_precio_reglas(_entrada_base(tolls_cost=10_000, ida_y_vuelta=True))
    assert ida_y_vuelta.precio_sugerido - solo_ida.precio_sugerido == pytest.approx(10_000)


def test_tiempo_de_espera_se_cobra_por_hora():
    sin_espera = calcular_precio_reglas(_entrada_base())
    con_espera = calcular_precio_reglas(_entrada_base(tiempo_espera_horas=2))
    assert con_espera.precio_sugerido > sin_espera.precio_sugerido


def test_viaje_de_varios_dias_usa_tarifa_diaria_mas_km_extra():
    resultado = calcular_precio_reglas(_entrada_base(
        distancia_km=700, categoria_vehiculo="VAN", num_dias=3,
    ))
    tarifa_dia = tarifa_base_km("VAN") * 150
    km_incluidos = k.KM_INCLUIDOS_POR_DIA_DEFECTO * 3
    esperado = tarifa_dia * 3 + (700 - km_incluidos) * tarifa_base_km("VAN")
    assert resultado.precio_sugerido == pytest.approx(esperado)


def test_precio_minimo_y_maximo_forman_un_rango_alrededor_del_sugerido():
    resultado = calcular_precio_reglas(_entrada_base())
    assert resultado.precio_minimo < resultado.precio_sugerido < resultado.precio_maximo


def test_desglose_de_reglas_suma_el_precio_total():
    resultado = calcular_precio_reglas(_entrada_base(
        tipo_via="DESTAPADA", tolls_cost=5000, tiempo_espera_horas=1,
        fecha_salida=datetime(2026, 12, 25, 22, tzinfo=timezone.utc),
    ))
    assert sum(c.monto for c in resultado.desglose) == pytest.approx(resultado.precio_sugerido)


# ── Dataset sintético + modelo de ML (cold start) ───────────────────────────
# Requieren numpy/pandas/scikit-learn (ver requirements.txt) — no son parte
# del núcleo de reglas de arriba, que no depende de ninguna de las dos.

def test_dataset_sintetico_tiene_las_columnas_que_espera_el_modelo():
    # Las columnas de interacción (distance_km__SEDAN, etc.) las genera
    # ml_model._expandir_interacciones a partir de estas — el dataset crudo
    # no las tiene todavía, y no debería tenerlas (ver ml_model.py).
    from app.pricing.ml_model import (
        COLUMNAS_CATEGORICAS,
        COLUMNAS_NUMERICAS_PLANAS,
        VARIABLES_ESCALADAS_POR_CATEGORIA,
        COLUMNA_OBJETIVO,
    )
    from app.pricing.synthetic_data import generar_dataset_sintetico

    df = generar_dataset_sintetico()
    columnas_esperadas = set(
        COLUMNAS_CATEGORICAS + COLUMNAS_NUMERICAS_PLANAS + VARIABLES_ESCALADAS_POR_CATEGORIA + [COLUMNA_OBJETIVO]
    )
    assert columnas_esperadas.issubset(set(df.columns))
    assert len(df) > 0
    assert (df["final_price"] > 0).all()


def test_modelo_entrena_y_predice_sobre_dataset_sintetico():
    from app.pricing.ml_model import ModeloPrecioSugerido
    from app.pricing.synthetic_data import generar_dataset_sintetico

    df = generar_dataset_sintetico()
    modelo = ModeloPrecioSugerido().fit(df)
    assert modelo.entrenado is True

    datos = _entrada_base(distancia_km=150)
    from app.pricing.features import construir_features
    prediccion = modelo.predict_one(datos, construir_features(datos))
    assert prediccion > 0


def test_obtener_precio_sugerido_usa_ml_o_reglas_pero_nunca_falla():
    """Con PriceHistory vacía en la base de test, esto fuerza el camino de
    cold start (dataset sintético) — nunca debería lanzar una excepción.

    (No se pide el fixture `db_session`: `obtener_precio_sugerido` no recibe
    una sesión — abre la suya propia contra la misma base de test a través de
    `app.database.SessionLocal` — pero la tabla `PriceHistory` igual existe
    gracias al fixture `_esquema_de_test`, que es autouse.)
    """
    from app.pricing.service import obtener_precio_sugerido

    resultado = obtener_precio_sugerido(_entrada_base())
    assert resultado.precio_sugerido > 0
    assert resultado.fuente in ("REGLAS", "ML (sintetico)")


# ── Endpoint HTTP ────────────────────────────────────────────────────────────

def test_endpoint_price_estimate(client, crear_pasajero, auth_headers):
    pasajero = crear_pasajero()
    salida = datetime.now(timezone.utc) + timedelta(days=2)

    respuesta = client.post(
        "/api/service-requests/price-estimate",
        json={
            "trip_type": "ONE_WAY",
            "departure_time": salida.isoformat(),
            "adults_count": 2,
            "children_count": 0,
            "distance_km": 45.5,
            "tolls_cost": 0,
            "tipo_via": "PAVIMENTADA",
        },
        headers=auth_headers(pasajero),
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["precio_sugerido"] > 0
    assert cuerpo["precio_minimo"] < cuerpo["precio_sugerido"] < cuerpo["precio_maximo"]
    assert cuerpo["categoria_vehiculo"] == "SEDAN"
    assert len(cuerpo["desglose"]) >= 1


def test_endpoint_price_estimate_rechaza_sin_autenticacion(client):
    respuesta = client.post("/api/service-requests/price-estimate", json={
        "trip_type": "ONE_WAY",
        "departure_time": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "adults_count": 1,
        "distance_km": 10,
    })
    assert respuesta.status_code == 401


def test_crear_viaje_queda_con_precio_sugerido(client, crear_pasajero, auth_headers):
    """El precio sugerido se calcula y persiste al publicar el viaje, siempre
    que venga distance_km (Google Maps ya resolvió la ruta)."""
    pasajero = crear_pasajero()
    salida = datetime.now(timezone.utc) + timedelta(days=2)

    respuesta = client.post(
        "/api/service-requests/",
        json={
            "origin": "Medellín, Antioquia",
            "destination": "Rionegro, Antioquia",
            "departure_time": salida.isoformat(),
            "trip_type": "ONE_WAY",
            "adults_count": 2,
            "children_count": 0,
            "has_pets": False,
            "distance_km": 30,
            "tipo_via": "PAVIMENTADA",
        },
        headers=auth_headers(pasajero),
    )

    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["suggested_price"] is not None
    assert float(cuerpo["suggested_price"]) > 0
    assert cuerpo["suggested_price_min"] is not None
    assert cuerpo["suggested_price_max"] is not None


def test_crear_viaje_sin_distancia_no_calcula_precio(client, crear_pasajero, auth_headers):
    """Si Google Maps no pudo resolver la ruta (distance_km ausente), el
    viaje igual se publica, solo que sin precio sugerido."""
    pasajero = crear_pasajero()
    salida = datetime.now(timezone.utc) + timedelta(days=2)

    respuesta = client.post(
        "/api/service-requests/",
        json={
            "origin": "Un lugar cualquiera",
            "destination": "Otro lugar",
            "departure_time": salida.isoformat(),
            "trip_type": "ONE_WAY",
            "adults_count": 1,
            "children_count": 0,
            "has_pets": False,
        },
        headers=auth_headers(pasajero),
    )

    assert respuesta.status_code == 201
    assert respuesta.json()["suggested_price"] is None
