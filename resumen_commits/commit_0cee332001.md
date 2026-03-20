## Commit: 0cee332001a0b9a8589349624ed7c286e38bd984
**Fecha:** Tue Apr 30 19:28:55 2024 +0530

### Descripción de los Cambios
Corrige un bug crítico en entornos HA (High Availability) donde el estado del usuario se establecía incorrectamente como "offline" sin verificar conexiones activas en otros nodos del cluster.

Cambios principales:
1. **Nueva interfaz de cluster**: Agrega método `WebConnCountForUser(userID string)` a la interfaz `ClusterInterface` para obtener el conteo de conexiones WebSocket de un usuario en todo el cluster
2. **Mensajes de cluster**: Define nuevos tipos de mensajes gossip:
   - `ClusterGossipEventRequestWebConnCount` - Solicita conteo de conexiones
   - `ClusterGossipEventResponseWebConnCount` - Responde con el conteo
3. **Lógica del Hub**: Modifica el manejo de desconexiones para:
   - Verificar conexiones activas locales con `ForUserActiveCount()`
   - Consultar a otros nodos del cluster antes de marcar como offline
   - Usar enfoque conservador: si hay error en la consulta al cluster, no marcar como offline
4. **Tests**: Agrega `TestHubWebConnCount` para verificar la funcionalidad de conteo de conexiones

El cambio asegura que un usuario solo se marque como offline cuando no tenga conexiones activas en ningún nodo del cluster, evitando estados incorrectos en entornos distribuidos.

### Veredicto del Cambio
A) Cambio útil que mejora/corrige - Corrección crítica de bug en entornos HA
