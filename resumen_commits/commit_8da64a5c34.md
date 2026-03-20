## Commit: 8da64a5c341e805ad12142b898bcdedd5b366453
**Fecha:** Fri May 3 09:06:06 2024 -0400

### Descripción de los Cambios
Agrega una configuración experimental para deshabilitar el handler de reconexión al despertar (`DisableWakeUpReconnectHandler`).

Cambios principales:
1. **Configuración del servidor** (`model/config.go`): Nueva opción `DisableWakeUpReconnectHandler` en `ExperimentalSettings` con valor por defecto `false`
2. **Configuración del cliente** (`config/client.go`): Expone la configuración al cliente web
3. **Admin Console** (`admin_definition.tsx`): Agrega checkbox para controlar la configuración
4. **Team Controller** (`team_controller.tsx`): Usa la configuración para condicionalmente ejecutar el handler de despertar
5. **Tipos TypeScript**: Actualiza `ClientConfig` y definiciones de tipos

Esta configuración permite reducir el tráfico de red al deshabilitar la detección automática cuando la computadora se despierta de suspensión.

### Veredicto del Cambio
A) Cambio útil que mejora/corrige - Nueva opción de configuración experimental para optimización de red
