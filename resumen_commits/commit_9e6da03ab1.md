## Commit: 9e6da03ab1a7df9327af469b14549e2285085bcc
**Fecha:** Mon Apr 22 09:40:08 2024 +0200

### Descripción de los Cambios
Este commit mejora el mensaje de error cuando se intenta mover un canal a un equipo donde ya existe un canal con el mismo nombre.

**Problema:** Anteriormente, cuando se movía un canal a otro equipo y había un conflicto de nombres duplicados, el mensaje de error no era claro para el usuario.

**Cambios implementados:**
1. **Nuevo tipo de error**: Se introduce `store.ErrUniqueConstraint` para manejar específicamente violaciones de restricciones únicas en la base de datos, en lugar de usar `store.ErrInvalidInput`.

2. **Mejora en el mensaje de error**: Ahora cuando se intenta mover un canal a un equipo que ya tiene un canal con el mismo nombre, se muestra el mensaje claro: "A channel with that name already exists on the same team."

3. **Unificación de manejo de errores**: Se unifica el manejo de errores entre las funciones `UpdateChannel` y `MoveChannel` en el archivo `channel.go`, asegurando consistencia en toda la aplicación.

4. **Actualización del store**: En `channel_store.go`, se cambia el retorno de error de `store.NewErrInvalidInput("Channel", "Name", channel.Name)` a `store.NewErrUniqueConstraint("Name")` cuando se detecta una violación de restricción única.

5. **Tests actualizados**: Se añade un nuevo test `Should return custom error with repeated channel` que verifica que el mensaje de error correcto se devuelve cuando hay canales duplicados.

### Veredicto del Cambio
A) Cambio útil que mejora la aplicación, corrige errores o añade funciones
