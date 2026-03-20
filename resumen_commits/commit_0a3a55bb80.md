## Commit: 0a3a55bb80262051a74009a1bb404e7980eb457b
**Fecha:** Mon May 6 09:46:16 2024 -0400

### Descripción de los Cambios
Agrega feature flag y configuración para métricas de rendimiento del cliente.

Cambios principales:
- Nuevo feature flag `ClientMetrics` en `model/feature_flags.go`
- Nueva configuración `MetricsSettings.EnableClientMetrics` en `model/config.go`
- Expone configuración al cliente en `config/client.go`
- Agrega UI en Admin Console para habilitar métricas de cliente
- Agrega traducciones para la configuración

La métrica de cliente permite monitorear el rendimiento de la app web y desktop.

### Veredicto del Cambio
A) Cambio útil que mejora/corrige - Nueva funcionalidad de métricas de rendimiento
