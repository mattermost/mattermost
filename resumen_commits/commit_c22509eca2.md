## Commit: c22509eca214f4b1640d314659a2c6e303537497
**Fecha:** Mon May 6 11:59:49 2024 +0200

### Descripción de los Cambios
Corrige la gestión del canal activo en el servidor para asegurar que se desmarque correctamente.

Cambios principales:
- Actualiza lógica de notificaciones push para manejar correctamente cuando no hay canal activo
- Mejora `notification.go` y `notification_push.go` para unset del canal activo
- Agrega tests para verificar el comportamiento
- Actualiza el menú del canal en la sidebar para manejar correctamente el estado
- Agrega acción Redux para unset del canal activo

### Veredicto del Cambio
A) Cambio útil que mejora/corrige - Corrección de gestión de canal activo
