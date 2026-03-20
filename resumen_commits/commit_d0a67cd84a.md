## Commit: d0a67cd84ad03d9c49ed9378408d32494843a054
**Fecha:** Mon Apr 22 12:42:13 2024 +0200

### Descripción de los Cambios
Este commit corrige los tipos TypeScript en el store para permitir que los equipos (teams) puedan ser `undefined`, mejorando la type safety de la aplicación.

**Problema:** Anteriormente, los selectores de equipos siempre retornaban un objeto Team, pero en realidad el equipo podría no existir (por ejemplo, cuando el usuario no ha seleccionado ningún equipo o el equipo fue eliminado). Esto causaba potenciales errores en runtime.

**Cambios principales:**

1. **Selectores modificados en `teams.ts`:**
   - `getCurrentTeam`: Ahora retorna `Team | undefined`
   - `getTeam`: Ahora retorna `Team | undefined`
   - `getCurrentTeamMembership`: Ahora retorna `TeamMembership | undefined`
   - `getMyTeamMember`: Ahora retorna `TeamMembership | undefined`
   - `getCurrentTeamStats`: Ahora retorna `TeamStats | undefined`
   - `getMembersInCurrentTeam` y `getMembersInTeam`: Ahora retornan `undefined` posible

2. **Nueva función añadida:**
   - `getRelativeTeamUrl`: Función que retorna la URL relativa de un equipo dado su ID, manejando el caso de equipo no encontrado

3. **Componentes actualizados** (más de 50 archivos):
   - Se añaden verificaciones `if (!team)` o `if (!currentTeam)` antes de acceder a propiedades
   - Se usan optional chaining (`?.`) para acceder a propiedades de equipos
   - Se actualizan las propiedades de componentes para aceptar `undefined`
   - Se corrigen tests para reflejar los nuevos tipos

4. **Cambios en permisos:**
   - `haveITeamPermission` y `haveIChannelPermission` ahora aceptan `teamId: string | undefined`

Estos cambios mejoran significativamente la robustez del código al manejar explícitamente los casos donde los equipos no están disponibles, previniendo errores de "cannot read property of undefined".

### Veredicto del Cambio
A) Cambio útil que mejora la aplicación, corrige errores o añade funciones
