## Commit: af031b4d0c1cf080210343592eaad64e388c0a7e
**Fecha:** Tue Apr 30 16:02:28 2024 +0200

### Descripción de los Cambios
Corrige errores de merge introducidos en el commit previo sobre listado de usuarios inactivos (b6a8965969). Los cambios incluyen:

1. **Reorganización de la interfaz Client**: Reordena los métodos alfabéticamente en `client.go` para mantener consistencia
2. **Mejora de `ResetListUsersCmd`**: 
   - Ahora acepta un parámetro `*testing.T` para mejor manejo de errores
   - Usa `require.NoError` para verificar que los flags se establecen correctamente
   - Retorna errores en lugar de ignorarlos
3. **Actualización de tests**: Todos los tests en `user_test.go` y `user_e2e_test.go` actualizados para:
   - Pasar el objeto `testing.T` a `ResetListUsersCmd`
   - Usar `s.Require().NoError()` para verificar errores al establecer flags

Estos cambios mejoran la calidad del código y previenen errores silenciosos en los tests.

### Veredicto del Cambio
A) Cambio útil que mejora/corrige - Corrección de merge y mejora de calidad de código en tests
