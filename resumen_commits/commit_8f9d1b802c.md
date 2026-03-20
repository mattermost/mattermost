## Commit: 8f9d1b802c
**Fecha:** 2024-05-09

### Descripción de los Cambios
[MM-58263] Remueve la verificación CSRF del endpoint /api/v4/client_perf.

Cambios principales:
- Elimina la verificación de token CSRF para el endpoint de métricas de cliente
- Permite que los clientes envíen métricas de performance sin autenticación CSRF
- Facilita la recopilación de métricas de performance del lado del cliente

### Veredicto del Cambio
A) Cambio útil que mejora/corrige - Mejora en recopilación de métricas
