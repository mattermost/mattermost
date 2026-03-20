## Commit: b091ef5686f7f51ae05caef30ac2258f73735e58
**Fecha:** Mon Apr 22 13:32:55 2024 -0400

### Descripción de los Cambios
Este commit elimina el acceso al estado global desde el sistema de internacionalización (i18n/i18n.jsx).

**Cambios realizados:**

1. **Componentes actualizados:**
   - `user_settings/display/index.ts`: Conectado a Redux para pasar props
   - `manage_languages/index.ts`: Conectado a Redux para pasar locale como prop
   - `manage_languages/manage_languages.tsx`: Recibe locale via props
   - `user_settings_display.tsx`: Recibe configuración de locale via props

2. **Sistema i18n refactorizado:**
   - `i18n/i18n.jsx`: Elimina acceso directo a `getState()` de Redux
   - Ahora recibe la configuración de locale mediante props

3. **Tests actualizados:**
   - Se actualizan los tests para proveer las nuevas props requeridas

Estos cambios desacoplan el sistema de internacionalización del estado global.

### Veredicto del Cambio
A) Cambio útil que mejora la aplicación, corrige errores o añade funciones
