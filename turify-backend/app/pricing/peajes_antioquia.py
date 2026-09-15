"""
Peajes de las salidas principales de Medellín hacia Antioquia — HU27 (SCRUM-170).

Por qué una base de datos local y no la Routes API de Google
--------------------------------------------------------------
La Routes API de Google (`computeRoutes` con `extraComputations: TOLLS`) SÍ
calcula peajes automáticamente, pero solo para un conjunto cerrado de
países/ciudades (EE.UU., Canadá, México, Brasil, Argentina, Australia, India,
Indonesia, Japón, entre otros) — Colombia no está en esa lista (verificado
sep-2026). No hay atajo: para tener peajes automáticos en Turify, la única
opción es un dato propio.

Por qué es viable pese a que "cada peaje es distinto"
--------------------------------------------------------------
El alcance de Turify es regional (transporte especial/intermunicipal dentro
de Antioquia, con Medellín como origen típico), no todo el país. Los peajes
relevantes son un conjunto pequeño y acotado — las salidas troncales de
Medellín hacia cada subregión — no cientos. Y las tarifas se actualizan de
forma predecible: una vez al año (mediados de enero), con el IPC certificado
por el DANE, publicadas por la Gobernación de Antioquia (peajes
departamentales) o la ANI (peajes concesionados nacionales). Mantener esta
tabla al día es una tarea de minutos, una vez al año — no un problema de
mantenimiento continuo.

Cómo se detecta qué peajes toca una ruta
--------------------------------------------------------------
Turify ya traza la ruta con Google Directions en el frontend y decodifica el
polyline completo (ver Dashboard.jsx::trazarRutaConCoords). Ese polyline
(decenas o cientos de puntos a lo largo de la vía) se manda una sola vez a
`calcular_peajes_de_ruta`, que revisa, para cada peaje conocido, si algún
punto de la ruta pasa lo bastante cerca (RADIO_DETECCION_METROS) — sin
necesidad de mapear manualmente "qué peajes tiene cada municipio", lo que sí
sería tedioso y no escalaría a nuevos destinos.

OJO — coordenadas por verificar
--------------------------------------------------------------
Las coordenadas de abajo son una MEJOR ESTIMACIÓN a partir de la ubicación
geográfica conocida de cada peaje (no de un GPS medido en sitio) — igual que
las tarifas de Van/Microbus/Bus en vehicle_categories.py, quedan marcadas
como estimación razonada, pendiente de verificar una por una en Google Maps
(clic derecho -> coordenadas) antes de confiar en esto para producción. Las
tarifas de categoría 1 (carro particular) sí están sacadas de fuentes
públicas citadas por peaje.
"""
from __future__ import annotations

from dataclasses import dataclass
from math import radians, sin, cos, sqrt, atan2

# Qué tan cerca de un punto de la ruta tiene que pasar un peaje conocido para
# contarlo como "la ruta pasa por ahí". 400m es generoso a propósito: mejor
# un falso positivo ocasional (se cobra un peaje que en realidad no aplica)
# que uno negativo (no se cobra uno real) — el pasajero ve el desglose y
# puede reclamar, mientras que un peaje faltante simplemente no se nota.
RADIO_DETECCION_METROS = 400


@dataclass(frozen=True)
class Peaje:
    nombre: str
    lat: float
    lng: float
    tarifa_categoria_1: float  # COP, un solo sentido (el x2 de ida/vuelta lo aplica features.py)
    corredor: str  # subregión de Antioquia a la que sale desde Medellín
    fuente: str


# Tarifas de categoría 1 para 2026, Gobernación de Antioquia / ANI (ver
# El Tiempo, El Colombiano, MiOriente — enero 2026).
PEAJES_ANTIOQUIA: list[Peaje] = [
    Peaje("Túnel de Oriente", 6.1305, -75.4790, 26300, "Oriente",
          "Gobernación de Antioquia, ene-2026"),
    Peaje("Variante Las Palmas", 6.1320, -75.4530, 20200, "Oriente",
          "Gobernación de Antioquia, ene-2026"),
    Peaje("Santa Elena", 6.1920, -75.4910, 15100, "Oriente",
          "Gobernación de Antioquia, ene-2026"),
    Peaje("Vía Pajarito (San Pedro de los Milagros)", 6.4420, -75.5600, 12900, "Norte",
          "Gobernación de Antioquia, ene-2026"),
    Peaje("Aburrá (San Cristóbal, antes del Túnel de Occidente)", 6.2865, -75.6432, 27300, "Occidente",
          "Devimar / ANI, 2026"),
    Peaje("Amagá", 6.0400, -75.7000, 20600, "Suroeste",
          "ANI, ene-2026"),
    Peaje("La Pintada", 5.7500, -75.6100, 23900, "Suroeste",
          "ANI, ene-2026"),
    Peaje("Cisneros", 6.5383, -75.0886, 29400, "Nordeste / Magdalena Medio",
          "ANI, ene-2026 (coordenadas: Wikipedia)"),
    Peaje("Puerto Berrío", 6.4900, -74.4000, 14083, "Magdalena Medio",
          "ANI, ene-2026"),
]


def _distancia_metros(lat1, lng1, lat2, lng2) -> float:
    """Distancia en línea recta (Haversine) entre dos puntos lat/lng, en metros."""
    R = 6371000.0
    lat1, lng1, lat2, lng2 = map(radians, [lat1, lng1, lat2, lng2])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlng / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


def calcular_peajes_de_ruta(puntos_ruta: list[dict]) -> dict:
    """Recibe el polyline decodificado de la ruta ([{"lat":.., "lng":..}, ...])
    y devuelve los peajes conocidos por los que pasa.

    Complejidad O(peajes x puntos) — con ~10 peajes y unos cientos de puntos
    de ruta, es despreciable (no hace falta indexar espacialmente para este
    volumen de datos).
    """
    detectados: list[Peaje] = []
    for peaje in PEAJES_ANTIOQUIA:
        for punto in puntos_ruta:
            if _distancia_metros(punto["lat"], punto["lng"], peaje.lat, peaje.lng) <= RADIO_DETECCION_METROS:
                detectados.append(peaje)
                break  # ya se confirmó este peaje, no hace falta seguir revisando sus puntos

    return {
        "tolls_cost": sum(p.tarifa_categoria_1 for p in detectados),
        "tolls_count": len(detectados),
        "peajes": [{"nombre": p.nombre, "tarifa": p.tarifa_categoria_1} for p in detectados],
    }
