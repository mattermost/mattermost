## Commit: 8348acac49198422d4762abf6d8dab29ffa21a4a
**Fecha:** Mon Apr 22 12:03:28 2024 +0200

### Descripción de los Cambios
Este commit es una refactorización masiva que asegura que los errores originales se envuelvan correctamente usando el método `.Wrap()` de `model.AppError` en lugar de convertirlos a strings.

**Problema:** Anteriormente, muchas llamadas a `model.NewAppError()` pasaban `err.Error()` como parámetro, lo que convertía el error en una cadena de texto. Esto perdía la información del tipo de error original, dificultando el uso de `errors.Is()` y `errors.As()` para inspeccionar errores.

**Patrón de cambio aplicado:**
- **Antes:** `model.NewAppError("funcName", "error.id", nil, err.Error(), http.StatusCode)`
- **Después:** `model.NewAppError("funcName", "error.id", nil, "", http.StatusCode).Wrap(err)`

**Archivos modificados (más de 30 archivos):**
- API handlers: channel.go, cloud.go, config.go, outgoing_oauth_connection.go, plugin.go, team.go, user.go, system.go, etc.
- App layer: cloud.go, desktop_login.go, draft.go, file.go, group.go, login.go, post.go, status.go, etc.

Este cambio mejora significativamente el manejo de errores en toda la aplicación, permitiendo:
- Detectar tipos específicos de errores con `errors.As()`
- Comprobar errores específicos con `errors.Is()`
- Mantener el stack trace completo de errores envueltos
- Mejorar el debugging y logging de errores

### Veredicto del Cambio
A) Cambio útil que mejora la aplicación, corrige errores o añade funciones
