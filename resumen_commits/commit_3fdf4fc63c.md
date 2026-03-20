## Commit: 3fdf4fc63c
**Fecha:** 2024-05-09

### Descripción de los Cambios
Usa GetMasterX() para asegurar escritura para el job RefreshPostStats.

Cambios principales:
- Cambia a conexión master para operaciones de escritura
- Asegura consistencia en las estadísticas de posts
- Mejora la confiabilidad del job de refresco de estadísticas

### Veredicto del Cambio
A) Cambio útil que mejora/corrige - Mejora en consistencia de base de datos
