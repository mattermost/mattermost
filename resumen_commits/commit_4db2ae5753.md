## Commit: 4db2ae5753f79ed369cd70f54ae75f6b3e01006b
**Fecha:** Wed May 1 10:44:09 2024 -0400

### Descripción de los Cambios
Asegura que el manejador de posts por lotes (batched post handler) también envíe reconocimientos (acknowledgements) por WebSocket al servidor.

Cambios principales:
1. **En `new_post.ts`**: Agrega `acknowledgePostedNotification` cuando ocurre un error al obtener el thread del post raíz (error: `missing_root_post`)
2. **En `websocket_actions.jsx`**: Agrega reconocimiento para cada post cuando se procesan demasiados posts en lote (`too_many_posts`)

Estos cambios mejoran la comunicación bidireccional cliente-servidor, permitiendo al servidor saber que el cliente recibió y procesó (o falló al procesar) los mensajes.

### Veredicto del Cambio
A) Cambio útil que mejora/corrige - Mejora el manejo de WebSocket y acknowledgements
