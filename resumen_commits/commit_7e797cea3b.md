## Commit: 7e797cea3b
**Fecha:** 2024-05-09

### Descripción de los Cambios
[MM-54757] Detiene el broadcast de mensajes channel_deleted/channel_restored desde canales privados a no-miembros.

Cambios principales:
- Evita que usuarios no miembros reciban notificaciones de canales privados eliminados o restaurados
- Mejora la privacidad y seguridad de los canales privados
- Reduce tráfico innecesario de WebSocket

### Veredicto del Cambio
A) Cambio útil que mejora/corrige - Mejora de privacidad y seguridad
