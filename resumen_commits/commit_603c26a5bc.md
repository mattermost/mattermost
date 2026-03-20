## Commit: 603c26a5bcda365917285b8f32c6982e170c5cd3
**Fecha:** Mon Apr 22 15:45:27 2024 +0500

### Descripción de los Cambios
Este commit convierte el componente `TeamListDropdown` en el panel de administración de Class Component a Function Component.

**Cambios realizados:**

1. **De Clase a Función**: El componente pasa de ser una clase con `React.PureComponent` a una función de componente con `memo` para mantener la optimización de rendimiento.

2. **Eliminación de estado innecesario**: Se elimina el estado `serverError` que no se utilizaba en el componente.

3. **Uso de hooks**:
   - `useIntl()` para internacionalización en lugar de `localizeMessage`
   - `useCallback` para memoizar las funciones de callback de los botones

4. **Mejoras en la internacionalización**:
   - Se reemplazan las llamadas a `localizeMessage()` por `intl.formatMessage()` siguiendo las mejores prácticas de react-intl

5. **Simplificación del código**:
   - Se elimina el constructor y la inicialización del estado
   - Las propiedades del equipo se calculan directamente en el render
   - Los handlers se crean con `useCallback` para evitar recreaciones innecesarias

El componente muestra un menú desplegable en la lista de equipos del administrador del sistema, permitiendo hacer administrador, convertir en miembro o eliminar usuarios de un equipo.

### Veredicto del Cambio
A) Cambio útil que mejora la aplicación, corrige errores o añade funciones
