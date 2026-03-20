## Commit: c9cb3d5bb08d126959f7ce62a9f434ee2a895c29
**Fecha:** Mon May 6 08:37:20 2024 +0200

### Descripción de los Cambios
Corrige casos de prueba E2E y configuración para GitHub Actions (GHA).

Cambios principales:
1. **Scripts CI**: Actualiza scripts de preparación y arranque del servidor para E2E
2. **Configuración**: Elimina `dashboard.override.yml` y actualiza `.e2erc`
3. **Tests corregidos**:
   - `channel_header_spec.ts`: Mejora selección de elementos
   - `license_no_license_spec.js`: Actualiza verificaciones de licencia
   - `sidebar_link_navigation_e20_spec.js`: Ajusta navegación
   - `code_theme_colors_spec.js`: Corrige tema de código
   - `login_close_server_spec.js`: Mejora manejo de servidor cerrado
   - `join_closed_team_with_not_allowed_email_spec.js`: Actualiza validación de email
   - `unread_with_bottom_start_toast_spec.js`: Ajusta verificación de toast
   - `admin_console.js`: Actualiza utilidades de admin console

### Veredicto del Cambio
A) Cambio útil que mejora/corrige - Corrección de tests E2E para CI
