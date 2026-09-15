"""Forma de salida común del motor de precio, la use la fórmula de reglas o
el modelo de ML — así el resto de la app (endpoints, PriceHistory) siempre
recibe la misma estructura sin importar cuál de los dos calculó el precio."""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ComponentePrecio:
    """Una línea del desglose (HU28: "desglose por componentes")."""
    concepto: str
    monto: float


@dataclass
class ResultadoPrecio:
    precio_sugerido: float
    precio_minimo: float
    precio_maximo: float
    precio_por_persona: float
    fuente: str  # "ML" | "REGLAS"
    desglose: list[ComponentePrecio] = field(default_factory=list)
    explicacion: str = ""
    es_nocturno: bool = False
    es_temporada_alta: bool = False
    motivo_temporada_alta: str | None = None
    categoria_vehiculo: str = ""
    excede_capacidad_maxima: bool = False

    def to_dict(self) -> dict:
        return {
            "precio_sugerido": round(self.precio_sugerido, -2),
            "precio_minimo": round(self.precio_minimo, -2),
            "precio_maximo": round(self.precio_maximo, -2),
            "precio_por_persona": round(self.precio_por_persona, -2),
            "fuente": self.fuente,
            "desglose": [{"concepto": c.concepto, "monto": round(c.monto, -2)} for c in self.desglose],
            "explicacion": self.explicacion,
            "es_nocturno": self.es_nocturno,
            "es_temporada_alta": self.es_temporada_alta,
            "motivo_temporada_alta": self.motivo_temporada_alta,
            "categoria_vehiculo": self.categoria_vehiculo,
            "excede_capacidad_maxima": self.excede_capacidad_maxima,
        }
