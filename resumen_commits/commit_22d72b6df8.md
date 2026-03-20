## Commit: 22d72b6df8084afb569c2be5987d2d42143d0f65
**Fecha:** Mon Apr 22 14:53:42 2024 -0400

### Descripción de los Cambios
Este commit elimina el acceso al estado global de Redux de varios archivos.

**Componentes actualizados:**
- `admin_console/license_settings/trial_banner`
- `invitation_modal` y utilidades asociadas  
- `overlay_trigger`

**Cambios:**
- TrialBanner refactorizado para no usar makeGetCategory
- Tests unitarios actualizados
- Componentes reciben datos via props

### Veredicto del Cambio
A) Cambio útil que mejora la aplicación, corrige errores o añade funciones
