"""
Motor de precio sugerido — ÉPICA 12 (SCRUM-222).

Sustituye el enfoque original de "agente IA basado en LLM" (ÉPICA 4) por un
modelo de Machine Learning (regresión lineal múltiple, HU29) entrenado con el
historial real de viajes (tabla PriceHistory), con una fórmula de reglas como
respaldo mientras no haya suficiente historial ("cold start").

Este paquete es la única fuente de verdad para todo lo relacionado con
calcular un precio: categorías de vehículo, festivos/temporada alta,
ingeniería de variables, la fórmula de reglas, el modelo de ML y el servicio
que decide cuál de los dos usar. Los routers (`service_requests.py`,
`drivers.py`) solo deben importar de aquí, nunca reimplementar esta lógica.
"""
