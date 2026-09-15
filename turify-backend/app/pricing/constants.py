"""Constantes de negocio del motor de precio sugerido (HU29)."""

# Recargo nocturno: salidas entre las 9pm y las 5am.
HORA_INICIO_RECARGO_NOCTURNO = 21  # 9pm
HORA_FIN_RECARGO_NOCTURNO = 5      # 5am
RECARGO_NOCTURNO = 0.20

# HU58 — recargo por defecto en temporada alta; el conductor puede ajustar el
# suyo propio (campo futuro), pero el motor de precio siempre parte de este.
RECARGO_TEMPORADA_ALTA = 0.20

# HU29 — "+15% vías sin pavimentar". Vía mixta se cobra a la mitad de ese
# recargo (criterio intermedio: no toda la ruta es difícil).
RECARGO_VIA_DESTAPADA = 0.15
RECARGO_VIA_MIXTA = RECARGO_VIA_DESTAPADA / 2

# Recargo por cada comodidad activa del vehículo (aire, wifi, etc.) —
# recalibrado en septiembre 2026: la versión original (1% por comodidad, tope
# 8%) salió inventada sin ninguna referencia y resultaba insignificante (unos
# $4.300 sobre un viaje típico). Los tiers "comfort/premium" de apps de
# transporte cobran entre 20% y 40% más que el estándar (Uber Comfort: +20%
# en Chile, +30% en Costa Rica, +25-30% típico; taxi de lujo vs básico en
# Medellín 2026: banderazo +44%, carrera mínima +46%). Con 3% por comodidad y
# tope en 24% (las 8 comodidades marcadas a la vez), un vehículo Premium
# completo queda en el rango bajo-medio de esa franja real — conservador
# porque acá "premium" es una casilla marcada, no una flota curada como Uber
# Comfort.
RECARGO_POR_COMODIDAD = 0.03
MAXIMO_RECARGO_COMODIDADES = 0.24

# Banda de incertidumbre alrededor del precio puntual sugerido, para mostrar
# un rango mínimo/máximo (HU28) en vez de un único número tajante.
FACTOR_PRECIO_MINIMO = 0.90
FACTOR_PRECIO_MAXIMO = 1.15

# Viajes de varios días (HU60): km incluidos/día por defecto si el vehículo no
# tiene uno configurado.
KM_INCLUIDOS_POR_DIA_DEFECTO = 200

# Niños menores de 2 años no cuentan como pasajero para efectos de capacidad
# ni de precio (HU29). El formulario actual solo distingue adultos/niños; el
# límite de edad para "infante" se aplica en el frontend al llenar
# `infants_count`, este motor solo confía en ese conteo.

# ── Cold start (HU29) ────────────────────────────────────────────────────────
# Mientras la tabla PriceHistory tenga menos filas reales que este umbral, no
# hay suficiente historial para entrenar un modelo confiable: se usa 100%
# fórmula de reglas. Con menos de un dataset sintético completo tampoco tiene
# sentido intentar un modelo "real + sintético a medias", así que es todo o
# nada por debajo del umbral.
MINIMO_MUESTRAS_REALES_PARA_ML = 30

# Tamaño del dataset sintético usado para poder entrenar y demostrar el
# modelo mientras no hay historial real (ver app/pricing/synthetic_data.py).
# Nunca se escribe en la base de datos: vive solo en memoria del proceso.
MUESTRAS_SINTETICAS_POR_CATEGORIA = 120
