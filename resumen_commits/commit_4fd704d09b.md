## Commit: 4fd704d09b107cfc50e3d686535d63b7c8f43e58
**Fecha:** Mon Apr 22 04:10:50 2024 +0300

### Descripción de los Cambios
Este commit migra las notificaciones de pruebas flaky (intermitentes) en los workflows de GitHub Actions para usar una acción reutilizable en lugar de un comando curl directo.

**Cambios específicos:**
- Reemplaza el comando curl que enviaba notificaciones a Mattermost con la acción reutilizable `mattermost/action-mattermost-notify@v2.0.0`
- La acción recibe el webhook URL a través de la variable `MATTERMOST_WEBHOOK_URL`
- El mensaje de notificación se pasa mediante el parámetro `TEXT` usando la sintaxis de bloque YAML (|-)
- El mensaje mantiene el mismo formato informativo sobre tests flaky detectados, incluyendo:
  - Enlace al job fallido en GitHub Actions
  - Instrucciones para contribuyentes sobre cómo manejar tests flaky
  - Referencias a ejemplos de PRs y tickets JIRA

Esta mejora hace el workflow más mantenible y aprovecha las acciones oficiales de Mattermost para notificaciones.

### Veredicto del Cambio
A) Cambio útil que mejora la aplicación, corrige errores o añade funciones
