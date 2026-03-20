## Commit: 39ba2e72c08405a33b7d3d17fbf3e4d58e7400df
**Fecha:** Mon Apr 22 11:33:37 2024 -0400

### Descripción de los Cambios
Este commit corrige un test intermitente (flaky test) relacionado con el servicio de ping para clusters remotos.

**Problema:** El test `ping_test.go` para el servicio de clusters remotos tenía comportamiento intermitente, causando fallos aleatorios en la suite de tests.

**Cambios realizados:**
- Refactorización del test de ping en `server/platform/services/remotecluster/ping_test.go`
- Mejora en la estructura del test para hacerlo más determinístico
- 56 líneas añadidas y 24 eliminadas, indicando una refactorización significativa

El test verifica la funcionalidad de ping entre servidores en configuraciones de cluster remoto, asegurando que la comunicación entre nodos remotos funcione correctamente.

### Veredicto del Cambio
A) Cambio útil que mejora la aplicación, corrige errores o añade funciones
