## Commit: 539daee63447f6a18f56d86a952563e85296fb93
**Fecha:** Mon May 6 12:04:36 2024 +0200

### Descripción de los Cambios
Corrige los tipos TypeScript para permitir que el store retorne canales `undefined`.

Cambios principales:
- Actualiza selectores de canales para retornar `Channel | undefined` en lugar de solo `Channel`
- Actualiza 52+ archivos para manejar correctamente el caso de canales undefined
- Mejora la seguridad de tipos en todo el código del webapp
- Afecta componentes como: `advanced_create_post`, `channel_header`, `forward_post_modal`, `thread_viewer`, entre otros
- Actualiza utilidades y acciones relacionadas con canales

Este cambio mejora la robustez del código al forzar el manejo explícito de casos donde un canal podría no existir en el store.

### Veredicto del Cambio
A) Cambio útil que mejora/corrige - Mejora de seguridad de tipos TypeScript
