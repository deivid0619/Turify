"""
Tarifas de referencia del Ministerio (SCRUM-257), cargadas del CSV que genera
scripts/importar_tarifas_ministerio.py. Siempre se usa la planilla del año más
reciente que haya en app/pricing/data/, así que cargar la del año siguiente
actualiza todo lo que sale de aquí sin tocar código.

Qué sale de aquí:
  * factor_ida_y_vuelta: cuánto más cuesta ida y vuelta que solo ida (SCRUM-256).
  * curva_referencia: precio de solo ida = base + por_km × km, ajustado por
    tamaño de vehículo a toda la planilla. Reemplaza la tarifa por km que se
    había estimado sin fuente para busetas y buses.
  * buscar_tarifa_referencia: la tarifa exacta de la planilla cuando el viaje
    es entre el Valle de Aburrá y uno de sus destinos.

La planilla cubre vehículos de 12 pasajeros en adelante; sedán y van siguen
con la fórmula de siempre. Se asume que sus precios incluyen peajes.
"""
from __future__ import annotations

import csv
import re
import unicodedata
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from statistics import median

_DATA = Path(__file__).parent / "data"

# Solo si no hubiera ninguna planilla cargada: valores de la planilla 2026.
_FACTOR_IDA_Y_VUELTA_RESPALDO = {True: 1.424, False: 1.30}

# La planilla trae una proporción de ida y vuelta para 12-16 pasajeros y otra desde 19.
_MAX_PASAJEROS_VEHICULO_PEQUENO = 16

# Rango de pasajeros de cada categoría que cubre la planilla (vehicle_categories.py).
_CATEGORIAS_CUBIERTAS = {"MICROBUS": (11, 19), "BUS": (20, 35), "BUS_GRANDE": (36, 60)}

# Punto de salida de la planilla: Medellín. Se acepta cualquier municipio del
# Valle de Aburrá; la diferencia de distancia se corrige con los km reales.
_VALLE_DE_ABURRA = {"MEDELLIN", "ENVIGADO", "ITAGUI", "BELLO", "SABANETA", "LA ESTRELLA"}

_DEPARTAMENTOS = {
    "ANTIOQUIA", "CALDAS", "QUINDIO", "RISARALDA", "CORDOBA", "SUCRE", "BOLIVAR", "ATLANTICO",
    "MAGDALENA", "LA GUAJIRA", "CESAR", "SANTANDER", "NORTE DE SANTANDER", "BOYACA",
    "CUNDINAMARCA", "TOLIMA", "HUILA", "VALLE DEL CAUCA", "CAUCA", "NARINO", "CHOCO", "META",
    "CAQUETA", "BOGOTA",
}

# Nombre oficial (como lo devuelve Google Maps) → nombre en la planilla.
_ALIAS = {
    "SANTA ROSA DE OSOS": "SANTA ROSA OSOS",
    "SAN ANDRES DE CUERQUIA": "SAN ANDRES DE C",
    "EL CARMEN DE VIBORAL": "CARMEN DEL VIBORAL",
    "DONMATIAS": "DON MATIAS",
    "SAN PEDRO DE LOS MILAGROS": "SAN PEDRO",
    "SAN VICENTE FERRER": "SAN VICENTE",
    "RETIRO": "EL RETIRO",
    "PENOL": "EL PENOL",
    "CAROLINA DEL PRINCIPE": "CAROLINA",
    "PUEBLORRICO": "PUEBLO RICO",
    "ANGOSTURA": "ANGOSTURA MARMATO",
    "SANTUARIO": "EL SANTUARIO",
    "COVENAS": "COVENAS TOLU",
    "SANTIAGO DE TOLU": "COVENAS TOLU",
    "EL CARMEN DE BOLIVAR": "CARMEN DE BOLIVAR",
    "MOMPOS": "MOMPOX",
    "SANTA CRUZ DE MOMPOX": "MOMPOX",
    "BOGOTA D C": "BOGOTA",
    "CARTAGENA DE INDIAS": "CARTAGENA",
    "SAN JOSE DE CUCUTA": "CUCUTA",
    "AEROPUERTO JOSE MARIA CORDOVA": "AEROPUERTO",
    "AEROPUERTO INTERNACIONAL JOSE MARIA CORDOVA": "AEROPUERTO",
}


def _normalizar(texto: str) -> str:
    t = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode().upper()
    t = re.sub(r"\(.*?\)", " ", t)
    t = re.sub(r"[^A-Z0-9 ]", " ", t)
    t = re.sub(r"\b\d{4,}\b", " ", t)  # códigos postales
    return " ".join(t.split())


@lru_cache(maxsize=1)
def _planilla() -> tuple[int | None, tuple[dict, ...]]:
    archivos = sorted(_DATA.glob("tarifas_ministerio_[0-9][0-9][0-9][0-9].csv"))
    if not archivos:
        return None, ()
    anio = int(archivos[-1].stem.rsplit("_", 1)[-1])
    with open(archivos[-1], encoding="utf-8") as fh:
        return anio, tuple(f for f in csv.DictReader(fh) if f["tipo"] == "DESTINO")


def _filas() -> tuple[dict, ...]:
    return _planilla()[1]


# ── Ida y vuelta (SCRUM-256) ─────────────────────────────────────────────────

@lru_cache(maxsize=2)
def _factor(vehiculo_pequeno: bool) -> float:
    razones = [
        int(f["precio_ida_vuelta"]) / int(f["precio_ida"])
        for f in _filas()
        if (int(f["capacidad_hasta"]) <= _MAX_PASAJEROS_VEHICULO_PEQUENO) == vehiculo_pequeno
        and int(f["precio_ida"]) > 0
    ]
    return median(razones) if razones else _FACTOR_IDA_Y_VUELTA_RESPALDO[vehiculo_pequeno]


def factor_ida_y_vuelta(num_pasajeros: int) -> float:
    """Cuánto más cuesta ida y vuelta que solo ida. En la planilla 2026: ×1,424
    hasta 16 pasajeros (la ida sale ~30% más barata) y ×1,30 desde 19. Sedán y
    van, que la planilla no trae, usan el de los pequeños."""
    return _factor(num_pasajeros <= _MAX_PASAJEROS_VEHICULO_PEQUENO)


# ── Curva de precio por tamaño de vehículo ──────────────────────────────────

@dataclass(frozen=True)
class Curva:
    tamano: str       # columna de la planilla, ej. "16 PX"
    base: float       # costo fijo del viaje
    por_km: float     # por km de ida (el regreso del vehículo ya va incluido)
    anio: int


@lru_cache(maxsize=1)
def _curvas() -> dict[str, Curva]:
    """Recta precio_ida = base + por_km × km para cada tamaño, sin las filas
    con km estimados y descartando las rutas atípicas (vías muy difíciles)."""
    anio, filas = _planilla()
    curvas = {}
    for tamano in dict.fromkeys(f["tamano"] for f in filas):
        puntos = [(float(f["km"]), float(f["precio_ida"])) for f in filas
                  if f["tamano"] == tamano and f["km_estimado"] == "0" and f["km"]]
        for _ in range(3):
            n = len(puntos)
            mx, my = sum(x for x, _ in puntos) / n, sum(y for _, y in puntos) / n
            por_km = sum((x - mx) * (y - my) for x, y in puntos) / sum((x - mx) ** 2 for x, _ in puntos)
            base = my - por_km * mx
            puntos = [(x, y) for x, y in puntos if abs(y / (base + por_km * x) - 1) < 0.35]
        curvas[tamano] = Curva(tamano, base, por_km, anio)
    return curvas


def _tamano_para(num_pasajeros: int) -> str | None:
    """La columna de la planilla del vehículo más pequeño donde caben."""
    tamanos = sorted({(int(f["capacidad_hasta"]), f["tamano"]) for f in _filas()})
    for capacidad, tamano in tamanos:
        if num_pasajeros <= capacidad:
            return tamano
    return tamanos[-1][1] if tamanos else None


def _pasajeros_efectivos(categoria: str, num_pasajeros: int) -> int | None:
    rango = _CATEGORIAS_CUBIERTAS.get(categoria)
    if not rango:
        return None
    return min(max(num_pasajeros, rango[0]), rango[1])


def curva_referencia(categoria: str, num_pasajeros: int) -> Curva | None:
    """Curva de la planilla para el vehículo de esa categoría. None para
    sedán y van, que la planilla no cubre."""
    n = _pasajeros_efectivos(categoria, num_pasajeros)
    tamano = _tamano_para(n) if n else None
    return _curvas().get(tamano) if tamano else None


# ── Tarifa exacta para un destino de la planilla ────────────────────────────

@dataclass(frozen=True)
class TarifaReferencia:
    destino: str      # como aparece en la planilla
    tamano: str
    precio: float     # solo ida, ya ajustado a la distancia real
    km_planilla: float
    anio: int


def _partes(direccion: str | None) -> tuple[list[str], str | None]:
    """Componentes de una dirección de Google Maps, de lo más específico al
    municipio, y el departamento si viene."""
    partes = [_normalizar(p) for p in (direccion or "").split(",")]
    partes = [p for p in partes if p and p != "COLOMBIA"]
    departamento = partes.pop() if partes and partes[-1] in _DEPARTAMENTOS else None
    return partes, departamento


def _municipio(direccion: str | None) -> str | None:
    partes, _ = _partes(direccion)
    return partes[-1] if partes else None


@lru_cache(maxsize=1)
def _indice_destinos() -> dict[str, list[str]]:
    indice: dict[str, list[str]] = {}
    for f in _filas():
        nombre = f["destino"]
        clave = _normalizar(nombre)
        if nombre not in indice.setdefault(clave, []):
            indice[clave].append(nombre)
    return indice


def _destino_en_planilla(direccion: str | None) -> str | None:
    partes, departamento = _partes(direccion)
    indice = _indice_destinos()
    for parte in partes:  # primero lo más específico: vereda, corregimiento, aeropuerto…
        candidatos = indice.get(_ALIAS.get(parte, parte))
        if not candidatos:
            continue
        if len(candidatos) > 1 and departamento:
            # ej. ARMENIA (ANT) vs ARMENIA (QUINDIO): se elige por el departamento
            pista = {"ANTIOQUIA": "ANT"}.get(departamento, departamento)
            for c in candidatos:
                if f"({pista})" in _normalizar_con_parentesis(c):
                    return c
        return min(candidatos, key=lambda c: ("(" in c, c))  # sin paréntesis primero
    return None


def _normalizar_con_parentesis(texto: str) -> str:
    return unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode().upper()


def buscar_tarifa_referencia(
    origen: str | None, destino: str | None, categoria: str, num_pasajeros: int, km_ruta: float | None,
) -> TarifaReferencia | None:
    """Tarifa de la planilla si el viaje es entre el Valle de Aburrá y uno de
    sus destinos (en cualquier sentido), para un vehículo que la planilla
    cubre. La diferencia entre los km reales y los de la planilla (ej. una
    vereda más allá del casco urbano) se cobra con el precio por km de la
    curva; si la diferencia es muy grande, no es el mismo viaje y no aplica."""
    n = _pasajeros_efectivos(categoria, num_pasajeros)
    if not n or not origen or not destino:
        return None
    tamano = _tamano_para(n)

    for salida, llegada in ((origen, destino), (destino, origen)):
        municipio_salida = _municipio(salida)
        if municipio_salida not in _VALLE_DE_ABURRA:
            continue
        nombre = _destino_en_planilla(llegada)
        if not nombre or _municipio(llegada) == municipio_salida:
            continue
        # Un destino dentro del mismo valle solo cuenta saliendo desde Medellín.
        if _municipio(llegada) in _VALLE_DE_ABURRA and municipio_salida != "MEDELLIN":
            continue
        fila = next(f for f in _filas() if f["destino"] == nombre and f["tamano"] == tamano)
        precio = float(fila["precio_ida"])
        km_planilla = float(fila["km"]) if fila["km"] else 0.0
        if km_ruta and fila["km_estimado"] == "0" and km_planilla:
            diferencia = km_ruta - km_planilla
            if abs(diferencia) > max(40.0, 0.5 * km_planilla):
                return None
            precio = max(precio + _curvas()[tamano].por_km * diferencia, precio * 0.6)
        return TarifaReferencia(nombre, tamano, precio, km_planilla, _planilla()[0])
    return None
