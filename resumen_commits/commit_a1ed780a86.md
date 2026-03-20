## Commit: a1ed780a861b47df70d26f0fae417a3795a90606
**Fecha:** Mon May 6 15:06:24 2024 +0500

### Descripción de los Cambios
Refactoriza y convierte los componentes permission gates de clase a funciones.

Cambios principales:
- Convierte `team_permission_gate` de Class Component a Function Component
- Convierte `any_team_permission_gate` de Class Component a Function Component  
- Convierte `channel_permission_gate` de Class Component a Function Component
- Convierte `system_permission_gate` de Class Component a Function Component
- Agrega componente base `gate.tsx` compartido
- Reorganiza la estructura de archivos eliminando carpetas `index.ts` separadas
- Actualiza tests para todos los gates
- Actualiza snapshots en múltiples componentes que usan los gates

### Veredicto del Cambio
A) Cambio útil que mejora/corrige - Modernización de componentes permission gates
