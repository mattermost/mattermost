## Commit: 69fe5c06e4fdd2daa5b79de8cd148c6d53bed793
**Fecha:** Mon May 6 10:47:48 2024 +0200

### Descripción de los Cambios
Habilita el linter `emptyStrCmp` para el código enterprise en `server/Makefile`.

El linter `emptyStrCmp` detecta comparaciones de strings vacíos que podrían ser más eficientes usando `len() == 0` en lugar de comparar con string vacío.

### Veredicto del Cambio
A) Cambio útil que mejora/corrige - Mejora de calidad de código con linter
