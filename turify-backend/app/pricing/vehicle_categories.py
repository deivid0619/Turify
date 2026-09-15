"""
Categorías de vehículo por capacidad — fuente única de verdad.

Antes de este módulo existían TRES copias de la misma tabla de rangos
(`app/routers/drivers.py`, `app/routers/service_requests.py`, y de forma
implícita en `PriceHistory.vehicle_category`); coincidían por suerte, pero
cualquier ajuste futuro (por ejemplo, mover el límite de MICROBUS) tenía que
hacerse a mano en los tres lugares. Ahora todos importan de aquí.

Los rangos de capacidad son los mismos que ya estaban en producción (HU55).
Las tarifas base por km (HU29) son un valor único por categoría —distinto del
rango (`tarifa_km_rango`) dentro del cual un conductor puede fijar su propia
`tarifa_km_base`— y se usan como variable de entrada del modelo y como base
de la fórmula de reglas.
"""
from __future__ import annotations

# (capacidad_min, capacidad_max, categoria, (tarifa_km_min, tarifa_km_max))
RANGOS_CATEGORIA = [
    (1, 4,   "SEDAN",      (1500, 3000)),
    (5, 10,  "VAN",        (2000, 4000)),
    (11, 19, "MICROBUS",   (2500, 5000)),
    (20, 35, "BUS",        (3000, 6000)),
    (36, 60, "BUS_GRANDE", (3500, 7000)),
]

# HU29 — "Tarifas base por tipo de vehículo: Sedán $1.500/km, Van $3.000/km,
# Microbús $4.500/km, Bus $6.000/km, Bus Ejecutivo $9.000/km". "Bus Ejecutivo"
# de la HU es la misma categoría que "BUS_GRANDE" en el resto del código
# (enum `vehicle_category` de PriceHistory, RANGOS_CATEGORIA de arriba).
TARIFA_BASE_KM_SUGERIDO = {
    "SEDAN": 1500,
    "VAN": 3000,
    "MICROBUS": 4500,
    "BUS": 6000,
    "BUS_GRANDE": 9000,
}

# Capacidad real máxima de la categoría más grande — por encima de esto, un
# solo vehículo no alcanza y se necesita coordinar varios (HU57, fuera del
# alcance de este sprint: por ahora solo se señala con `excede_capacidad_maxima`).
CAPACIDAD_MAXIMA_UN_VEHICULO = RANGOS_CATEGORIA[-1][1]

# Orden de categorías de menor a mayor capacidad — útil para "la categoría más
# económica que alcanza para N pasajeros".
CATEGORIAS_EN_ORDEN = [c for _, _, c, _ in RANGOS_CATEGORIA]


def calcular_categoria(capacidad: int) -> str:
    """Categoría de vehículo según su capacidad de pasajeros."""
    for minimo, maximo, categoria, _ in RANGOS_CATEGORIA:
        if minimo <= capacidad <= maximo:
            return categoria
    return "BUS_GRANDE" if capacidad > CAPACIDAD_MAXIMA_UN_VEHICULO else "SEDAN"


def rango_tarifa_km(categoria: str) -> list:
    """Rango [min, max] en COP/km dentro del que un conductor puede fijar su
    propia tarifa por km para esa categoría (no confundir con la tarifa base
    fija que usa el motor de precio sugerido)."""
    for _, _, cat, rango in RANGOS_CATEGORIA:
        if cat == categoria:
            return list(rango)
    return [1500, 3000]


def tarifa_base_km(categoria: str) -> float:
    """Tarifa base COP/km del motor de precio sugerido (HU29) para una
    categoría de vehículo. Cae a la tarifa de SEDAN si la categoría no se
    reconoce, para nunca devolver 0."""
    return TARIFA_BASE_KM_SUGERIDO.get(categoria, TARIFA_BASE_KM_SUGERIDO["SEDAN"])


def sugerir_categoria_para_pasajeros(total_pasajeros: int) -> dict:
    """La categoría de vehículo más económica cuya capacidad alcanza para
    `total_pasajeros`. Si nadie alcanza (grupo > 60), devuelve la categoría
    más grande igual y marca `excede_capacidad_maxima=True` — HU57 (grupos con
    múltiples vehículos) es quien resuelve ese caso combinando varios
    vehículos; este motor de precio solo lo señala.
    """
    for minimo, maximo, categoria, _ in RANGOS_CATEGORIA:
        if total_pasajeros <= maximo:
            return {"categoria": categoria, "excede_capacidad_maxima": False}
    return {"categoria": "BUS_GRANDE", "excede_capacidad_maxima": True}
