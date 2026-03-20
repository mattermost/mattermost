## Commit: 3bd6c444133a717a8de1e109029f10007df13fc6
**Fecha:** Tue Apr 30 17:40:37 2024 -0400

### Descripción de los Cambios
Corrige un tipo incorrecto en el componente `desktop_auth_token.tsx`. 

El callback `onLogin` tenía la firma incorrecta `(userProfile: UserProfile) => void` cuando en realidad no recibe ningún argumento. El cambio:
1. Actualiza el tipo de `onLogin` a `() => void`
2. Elimina la importación innecesaria de `UserProfile`
3. Actualiza las llamadas a `onLogin()` para no pasar argumentos
4. Simplifica el código removiendo la variable `userProfile` no utilizada

### Veredicto del Cambio
A) Cambio útil que mejora/corrige - Corrección de tipo TypeScript
