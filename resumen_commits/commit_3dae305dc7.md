## Commit: 3dae305dc73c0d1842c36d39a151257739964fee
**Fecha:** Mon Apr 22 12:19:53 2024 +0200

### Descripción de los Cambios
Este commit añade nuevos comandos a mmctl (la herramienta de línea de comandos de Mattermost) para gestionar trabajos de sincronización LDAP.

**Nuevos comandos añadidos:**
1. **`mmctl ldap job list`**: Lista los trabajos de sincronización LDAP
   - Flags disponibles:
     - `--page`: Número de página a obtener
     - `--per-page`: Número de trabajos por página (default 200)
     - `--all`: Obtener todos los trabajos (ignora `--page`)

2. **`mmctl ldap job show [ldapJobID]`**: Muestra detalles de un trabajo específico de sincronización LDAP
   - Soporta autocompletado de shell para el ID del trabajo

**Cambios técnicos:**
- Se crea el subcomando `LdapJobCmd` con los subcomandos `list` y `show`
- Se implementa la función `ldapJobListCmdF` que reutiliza la lógica existente `jobListCmdF` con el tipo `model.JobTypeLdapSync`
- Se implementa la función `ldapJobShowCmdF` para mostrar detalles de un trabajo específico
- Se añade función de autocompletado `ldapJobShowCompletionF` para buscar trabajos LDAP
- Se elimina el comentario `//nolint:unused` de la función `validateArgsWithClient` en `completion.go` ya que ahora se usa
- Se añaden tests unitarios y E2E para los nuevos comandos
- Se genera documentación en formato RST para los nuevos comandos

### Veredicto del Cambio
A) Cambio útil que mejora la aplicación, corrige errores o añade funciones
