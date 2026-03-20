## Commit: 4b934d2a62a1247d2f7e2b60a82fc73db0184ec5
**Fecha:** Mon Apr 22 12:42:54 2024 +0200

### Descripción de los Cambios
Este commit corrige un problema donde el panel derecho (RHS - Right Hand Side) recibía el foco automáticamente al volver de un estado suprimido.

**Problema:** Cuando el RHS estaba suprimido (por ejemplo, al abrir ciertos modales) y luego se restauraba, el campo de texto de comentarios recibía el foco automáticamente, lo cual no era el comportamiento deseado.

**Cambios implementados:**

1. **Nuevo estado en Redux**: Se añade `shouldFocusRHS` al estado del RHS para controlar cuándo debe enfocarse el panel.

2. **Nueva acción**: `focusedRHS()` - Se dispara después de enfocar el RHS para resetear el estado `shouldFocusRHS` a `false`.

3. **Nuevo action type**: `RHS_FOCUSED` - Indica que el RHS ya ha sido enfocado.

4. **Refactorización de componentes**:
   - `AdvancedCreateComment`: Reemplaza `focusOnMount` por `shouldFocusRHS` y añade callback `focusedRHS`.
   - `ThreadViewer`: Ya no pasa `fromSuppressed` ni el objeto `channel` completo, solo `channelId`.
   - `VirtualizedThreadViewer`: Simplifica la lógica de foco eliminando el tracking de `userScrolled`.

5. **Lógica del reducer**: 
   - `shouldFocusRHS` se pone a `true` cuando se selecciona un post o se cambia el thread seleccionado.
   - Se pone a `false` cuando se hace highlight de una respuesta o cuando se confirma que el RHS fue enfocado.

6. **Tests actualizados**: Se corrigen tests para reflejar los cambios en las props y se eliminan tests específicos de `fromSuppressed`.

### Veredicto del Cambio
A) Cambio útil que mejora la aplicación, corrige errores o añade funciones
