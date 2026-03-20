## Commit: acfbcb92f634728d3f40018befc37163439ee08a
**Fecha:** Tue Apr 23 08:16:49 2024 +0530

### Descripción de los Cambios
Este commit corrige un bug donde el estado de usuario se quedaba atascado en "online" al cerrar la pestaña.

**Problema:**
Código obsoleto marcaba el canal como leído al descargar la pestaña, causando una condición de carrera con el servidor.

**Solución:**
Se eliminó el código que marcaba el canal como leído durante el evento unload.

**Impacto:**
- Corrige estado incorrectamente atascado en "online"
- Elimina condición de carrera
- Mejora precisión del estado de presencia

### Veredicto del Cambio
A) Cambio útil que mejora la aplicación, corrige errores o añade funciones
