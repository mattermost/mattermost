## Commit: f3b80f77a6ca38492407cde157b4c6847f16b662
**Fecha:** Mon Apr 22 13:31:27 2024 -0400

### Descripción de los Cambios
Este commit elimina el acceso al estado global de Redux desde el componente `root`, dividiendo el trabajo en 5 partes:

**Parte 1 - Rudder:** Eliminación de dependencia de estado global para analytics
**Parte 2 - Luxon:** Mejora en el manejo de fechas sin acceso a estado global  
**Parte 3 - Recent emojis:** Emojis recientes manejados via props en lugar de estado global
**Parte 4 - Redirect to onboarding:** Redirección al onboarding sin acceso a estado global
**Parte 5 - Login logout handler:** Manejadores de login/logout desacoplados del estado global

**Archivos modificados:**
- `webapp/channels/src/actions/views/root.ts`
- Snapshots de tests actualizados

Estos cambios mejoran la testabilidad y mantenibilidad del código al reducir el acoplamiento con el estado global de Redux.

### Veredicto del Cambio
A) Cambio útil que mejora la aplicación, corrige errores o añade funciones
