"""
Importa la planilla anual "Tarifas para viajes ocasionales" (PDF) a un CSV
limpio que usa el motor de precios (SCRUM-257).

La planilla la actualiza el Ministerio cada año, así que esto se corre una vez
por año con el PDF nuevo:

    pip install -r requirements-dev.txt
    python scripts/importar_tarifas_ministerio.py "TARIFAS ... 2026.pdf" 2026

Genera en app/pricing/data/:
  * tarifas_ministerio_<año>.csv              una fila por destino y tamaño
  * tarifas_ministerio_<año>_correcciones.csv qué valores se corrigieron y por qué

Correcciones: la planilla trae errores de digitación (un dígito de más o de
menos, celdas en 0, valores que no cuadran con el resto de la fila) y filas
sin km. En vez de descartarlas, se "acercan" a lo que dice el resto de la
tabla, y todo queda registrado en el reporte para poder revisarlo.
"""
from __future__ import annotations

import csv
import math
import re
import sys
from pathlib import Path
from statistics import median

from pypdf import PdfReader

TAMANOS = [("12 PX", 12, 12), ("14 PX", 14, 14), ("16 PX", 16, 16),
           ("19 PX", 19, 19), ("22-25 PX", 22, 25), ("30-42 PX", 30, 42)]
FILAS_POR_HORA = {"HORA DIURNA", "HORA NOCTURNA"}

# Anclado a número completo: sin esto, el "0" final de un km como "40"
# se tomaba como una celda en 0 y corría toda la fila una posición.
_PRECIO = r"(?<![\d.])(?:\d{1,3}(?:\.\d{3})+|0)(?![\d.])"
_BLOQUE_PRECIOS = re.compile(rf"(?:{_PRECIO}\s+){{11}}{_PRECIO}")
_KM_DESTAPADOS = re.compile(r"(\d+)\s*Kms?\.?\s*(?:dest|des)\b", re.IGNORECASE)

# Umbrales de la limpieza (sobre log-precio, ver _limpiar_precios).
_ERROR_GRUESO = math.log(2.5)      # probablemente un dígito de más o de menos
_ERROR_MODERADO = math.log(1.4)    # no cuadra con el resto de la fila
_DIGITO_OK = math.log(1.3)         # tras ×10 / ÷10 ya cuadra


def _a_numero(texto: str) -> int:
    return int(texto.replace(".", ""))


def extraer_filas(ruta_pdf: str) -> list[dict]:
    """Lee el PDF y devuelve una fila por destino con sus 12 precios.

    El ancla de cada fila es el bloque de 12 precios seguidos; lo que queda
    entre un bloque y el siguiente es [ruta de la fila anterior][DESTINO][km].
    El destino se separa de la ruta porque va todo en mayúsculas."""
    texto = "\n".join(p.extract_text() for p in PdfReader(ruta_pdf).pages)
    texto = re.sub(r"DESTINO KMS.*?OBSERVACIONES", " ", texto)
    texto = re.sub(r"\s+", " ", texto)

    filas, fin_anterior = [], 0
    for m in _BLOQUE_PRECIOS.finditer(texto):
        tokens = texto[fin_anterior:m.start()].split()
        km = int(tokens.pop()) if tokens and re.fullmatch(r"\d{1,4}", tokens[-1]) else None
        nombre = []
        while tokens and not re.search(r"[a-záéíóúñü]", tokens[-1]):
            nombre.insert(0, tokens.pop())
        if filas:
            filas[-1]["ruta"] = " ".join(tokens)
        precios = [_a_numero(p) for p in m.group(0).split()]
        filas.append({
            "destino": " ".join(nombre),
            "km": km,
            "ida": precios[0::2],
            "ida_vuelta": precios[1::2],
        })
        fin_anterior = m.end()
    if filas:
        filas[-1]["ruta"] = texto[fin_anterior:].strip()

    # Nombres repetidos (ej. dos "VUELTA ORIENTE" con recorridos distintos):
    # se diferencian con la primera parte de la ruta.
    vistos: dict[str, int] = {}
    for f in filas:
        vistos[f["destino"]] = vistos.get(f["destino"], 0) + 1
    for f in filas:
        if vistos[f["destino"]] > 1:
            f["destino"] = f"{f['destino']} ({f['ruta'][:40].strip().rstrip(',')})"
    return filas


def _median_polish(matriz: list[list[float]], iteraciones: int = 8):
    """Descompone log(precio) = efecto_fila + efecto_columna + residuo, con
    medianas (robusto a unas pocas celdas malas por fila)."""
    filas_ef = [0.0] * len(matriz)
    cols_ef = [0.0] * len(matriz[0])
    for _ in range(iteraciones):
        for i, fila in enumerate(matriz):
            vals = [v - cols_ef[j] for j, v in enumerate(fila) if v is not None]
            filas_ef[i] = median(vals)
        for j in range(len(cols_ef)):
            vals = [fila[j] - filas_ef[i] for i, fila in enumerate(matriz) if fila[j] is not None]
            cols_ef[j] = median(vals)
    return filas_ef, cols_ef


def _limpiar_precios(filas: list[dict], correcciones: list[dict]) -> None:
    """Corrige los precios de ida y recalcula ida y vuelta con la proporción
    que usa la propia planilla para ese tamaño de vehículo."""
    destinos = [f for f in filas if f["destino"] not in FILAS_POR_HORA]

    # Proporción ida y vuelta / ida por tamaño: la planilla la aplica igual en
    # todas las filas, así que la mediana es el valor de la fórmula original.
    proporcion = []
    for k in range(len(TAMANOS)):
        razones = [f["ida_vuelta"][k] / f["ida"][k] for f in destinos if f["ida"][k] > 0]
        proporcion.append(median(razones))

    def registrar(f, k, campo, antes, despues, motivo):
        correcciones.append({"destino": f["destino"], "campo": f"{campo} {TAMANOS[k][0]}",
                             "valor_original": antes, "valor_corregido": despues, "motivo": motivo})

    logs = [[math.log(v) if v > 0 else None for v in f["ida"]] for f in destinos]
    for _ in range(3):  # se repite: una celda corregida mejora el ajuste de su fila
        ef_fila, ef_col = _median_polish(logs)
        hubo_cambios = False
        for i, f in enumerate(destinos):
            for k, valor in enumerate(f["ida"]):
                esperado = math.exp(ef_fila[i] + ef_col[k])
                residuo = None if valor <= 0 else math.log(valor / esperado)
                nuevo, motivo = None, None
                if residuo is None:
                    nuevo, motivo = round(esperado), "celda vacía o en 0: estimada con el resto de la fila"
                elif abs(residuo) > _ERROR_GRUESO:
                    for factor, texto in ((10, "le faltaba un dígito"), (0.1, "le sobraba un dígito")):
                        if abs(math.log(valor * factor / esperado)) < _DIGITO_OK:
                            nuevo, motivo = round(valor * factor), texto
                            break
                    else:
                        nuevo, motivo = round(esperado), "no cuadraba con el resto de la fila: estimada"
                elif abs(residuo) > _ERROR_MODERADO:
                    nuevo, motivo = round(esperado), "no cuadraba con el resto de la fila: estimada"
                if nuevo is not None:
                    registrar(f, k, "ida", valor, nuevo, motivo)
                    f["ida"][k] = nuevo
                    logs[i][k] = math.log(nuevo)
                    hubo_cambios = True
        if not hubo_cambios:
            break

    # Un vehículo más grande no debería salir más barato que uno más pequeño
    # en el mismo destino. Si pasa, se corrige la celda que peor cuadra con su
    # fila; se recorre de menor a mayor para que cada arreglo se compare ya
    # contra los valores corregidos.
    ef_fila, ef_col = _median_polish(logs)
    for i, f in enumerate(destinos):
        for k in range(1, len(TAMANOS)):
            if f["ida"][k] >= f["ida"][k - 1] * 0.97:
                continue
            res_ant = abs(math.log(f["ida"][k - 1]) - ef_fila[i] - ef_col[k - 1])
            res_act = abs(math.log(f["ida"][k]) - ef_fila[i] - ef_col[k])
            if res_act >= res_ant:   # el grande está bajo: se sube
                j = k
                nuevo = max(round(math.exp(ef_fila[i] + ef_col[j])), f["ida"][k - 1])
            else:                    # el pequeño está alto: se baja
                j = k - 1
                nuevo = min(round(math.exp(ef_fila[i] + ef_col[j])), f["ida"][k])
                if j > 0:
                    nuevo = max(nuevo, f["ida"][j - 1])
            registrar(f, j, "ida", f["ida"][j], nuevo,
                      "vehículo más grande salía más barato que uno más pequeño: acercada")
            f["ida"][j] = nuevo

    # Ida y vuelta: coherente con la ida (misma proporción de la planilla).
    for f in filas:
        for k in range(len(TAMANOS)):
            if f["destino"] in FILAS_POR_HORA:
                continue
            esperado = round(f["ida"][k] * proporcion[k])
            if abs(f["ida_vuelta"][k] - esperado) > 0.02 * esperado:
                registrar(f, k, "ida y vuelta", f["ida_vuelta"][k], esperado,
                          f"no cuadraba con la ida (la planilla usa ida × {proporcion[k]:.3f})")
                f["ida_vuelta"][k] = esperado


def _limpiar_km(filas: list[dict], correcciones: list[dict]) -> None:
    """Estima los km que faltan, y corrige los que no cuadran con el precio
    (todos los tamaños de la fila apuntan a una distancia muy distinta)."""
    destinos = [f for f in filas if f["destino"] not in FILAS_POR_HORA]
    rectas = []
    for k in range(len(TAMANOS)):
        puntos = [(f["km"], f["ida"][k]) for f in destinos if f["km"]]
        for _ in range(3):  # recta precio = a + b·km, sacando los puntos atípicos
            n = len(puntos)
            mx, my = sum(p[0] for p in puntos) / n, sum(p[1] for p in puntos) / n
            b = sum((x - mx) * (y - my) for x, y in puntos) / sum((x - mx) ** 2 for x, _ in puntos)
            a = my - b * mx
            puntos = [(x, y) for x, y in puntos if abs(y / (a + b * x) - 1) < 0.45]
        rectas.append((a, b))

    def km_segun_precio(f):
        return round(median((f["ida"][k] - a) / b for k, (a, b) in enumerate(rectas)))

    for f in destinos:
        f["km_estimado"] = False
        if f["km"] is None:
            f["km"], f["km_estimado"] = km_segun_precio(f), True
            correcciones.append({"destino": f["destino"], "campo": "km", "valor_original": "",
                                 "valor_corregido": f["km"], "motivo": "sin km en la planilla: estimados según el precio"})
            continue
        razon = median(f["ida"][k] / (a + b * f["km"]) for k, (a, b) in enumerate(rectas))
        # Precio muy BAJO para la distancia: casi seguro un km mal digitado.
        # Precio muy ALTO no se toca: suele ser una vía difícil (ej. Quibdó
        # por la trocha), no un error de la planilla.
        if f["km"] > 60 and razon < 0.55:
            nuevo = km_segun_precio(f)
            correcciones.append({"destino": f["destino"], "campo": "km", "valor_original": f["km"],
                                 "valor_corregido": nuevo,
                                 "motivo": "los precios de toda la fila corresponden a otra distancia: km estimados según el precio"})
            f["km"], f["km_estimado"] = nuevo, True


def importar(ruta_pdf: str, anio: int, destino_dir: Path) -> tuple[Path, Path, int, int]:
    filas = extraer_filas(ruta_pdf)
    correcciones: list[dict] = []
    _limpiar_precios(filas, correcciones)
    _limpiar_km(filas, correcciones)

    destino_dir.mkdir(parents=True, exist_ok=True)
    ruta_csv = destino_dir / f"tarifas_ministerio_{anio}.csv"
    ruta_corr = destino_dir / f"tarifas_ministerio_{anio}_correcciones.csv"

    with open(ruta_csv, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["destino", "tipo", "km", "km_estimado", "km_destapados", "ruta",
                    "tamano", "capacidad_desde", "capacidad_hasta", "precio_ida", "precio_ida_vuelta"])
        for f in filas:
            tipo = "POR_HORA" if f["destino"] in FILAS_POR_HORA else "DESTINO"
            dest = _KM_DESTAPADOS.search(f.get("ruta", ""))
            for k, (tamano, desde, hasta) in enumerate(TAMANOS):
                w.writerow([f["destino"], tipo, f["km"] or "", int(f.get("km_estimado", False)),
                            dest.group(1) if dest else "", f.get("ruta", ""),
                            tamano, desde, hasta, f["ida"][k], f["ida_vuelta"][k]])

    with open(ruta_corr, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=["destino", "campo", "valor_original", "valor_corregido", "motivo"])
        w.writeheader()
        w.writerows(correcciones)

    return ruta_csv, ruta_corr, len(filas), len(correcciones)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("Uso: python scripts/importar_tarifas_ministerio.py <planilla.pdf> <año>")
    salida = Path(__file__).resolve().parent.parent / "app" / "pricing" / "data"
    csv_path, corr_path, n_filas, n_corr = importar(sys.argv[1], int(sys.argv[2]), salida)
    print(f"{n_filas} filas -> {csv_path}")
    print(f"{n_corr} correcciones -> {corr_path}")
