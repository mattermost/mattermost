# Planning del issue #15976: búsquedas recientes

- **Issue:** [Allow users to access recent searches](https://github.com/mattermost/mattermost/issues/15976).
- **Equipo:** cuatro integrantes.
- **Decisión de arquitectura:** persistir el historial en una tabla específica, siguiendo las capas existentes del repositorio.
- **Referencia de la revisión:** checkout `1f33d75c0c`.
- **Estado:** propuesta de trabajo; implementación pendiente.

## Objetivo y alcance

Permitir que cada usuario consulte, vuelva a ejecutar y elimine sus búsquedas recientes. El historial debe persistir entre sesiones y mantenerse coherente entre las sesiones conectadas del mismo usuario.

El alcance inicial comprende búsquedas de mensajes y archivos. Las búsquedas proporcionadas por plugins deben conservar su funcionamiento actual; incorporar su historial queda fuera de esta primera versión.

El issue solicita mostrar hasta cinco búsquedas, ordenadas por recencia y ubicadas debajo de las opciones de búsqueda. También establece una altura máxima de 550 px para el desplegable y un control de eliminación con tooltip “Clear”.

**Supuesto de planificación:** conservar y mostrar las cinco búsquedas más recientes por usuario. El límite de cinco entradas almacenadas es una decisión propuesta del equipo; el issue solo exige ese límite para la visualización. Este supuesto debe cerrarse en la tarea técnica inicial.

## Enfoque de arquitectura

El recorrido de las operaciones será:

```text
Componente React → acción Redux → Client4 → API → App → Store → SQL
```

El servidor será responsable de la persistencia, la autorización, las fechas, la deduplicación y la retención. Redux mantendrá una copia del historial para la interfaz. Los eventos WebSocket permitirán comunicar cambios a las sesiones conectadas del usuario.

Cada entrada incluirá un identificador, el usuario propietario, el texto de la consulta, el tipo de búsqueda, el equipo o alcance y la fecha del último uso. Una búsqueda repetida se identificará por su texto, tipo y alcance.

El registro se disparará una sola vez al confirmar la búsqueda en el buscador. Esto evita duplicados, porque el flujo actual puede consultar mensajes y archivos para una misma búsqueda.

## TT-01 — Acordar el contrato y preparar la migración

**Participantes:** los cuatro integrantes; coordinación entre los integrantes 1 y 2.

**Objetivo:** permitir que backend, estado del cliente, interfaz y pruebas avancen con un contrato compartido.

Entregables:

- Modelo de una búsqueda reciente y formatos de solicitud, respuesta y error.
- Operaciones de registrar, consultar y eliminar, con las reglas de autorización correspondientes.
- Regla precisa de deduplicación y tratamiento del texto, preservando sus operadores de búsqueda.
- Decisión sobre el límite de almacenamiento y la política de retención.
- Formato del evento WebSocket y comportamiento al reconectar.
- Estrategia de concurrencia para registro, actualización y limpieza por usuario.
- Datos simulados compartidos para desarrollar la interfaz y preparar pruebas.
- Estrategia de migración compatible con las instalaciones que ya tengan la tabla heredada `recentsearches`.

Existe una migración antigua de `recentsearches` marcada como sin uso. Se debe revisar su compatibilidad y preparar una migración nueva, sin editar la migración histórica.

**Criterio de cierre:** todos los integrantes pueden implementar sus partes usando el mismo contrato y los mismos ejemplos.

## HU-01 — Registrar las búsquedas realizadas

> Como usuario, quiero que se guarden mis búsquedas para poder recuperarlas posteriormente.

### Criterios de aceptación

- Al confirmar una búsqueda no vacía, se registra su texto, tipo, equipo o alcance y fecha de último uso.
- La fecha la asigna el servidor.
- Repetir una búsqueda con el mismo texto, tipo y alcance actualiza su fecha, sin crear un duplicado.
- Se conservan las cinco búsquedas más recientes del usuario, sujeto al límite acordado en TT-01.
- Escribir en el campo, seleccionar una sugerencia o paginar resultados no registra una búsqueda nueva.
- Si falla el guardado del historial, la búsqueda puede continuar.

### Trabajo técnico

- Implementar el modelo, la migración, la interfaz `Store` y el almacenamiento SQL.
- Incorporar las reglas de registro en `App` y la operación correspondiente en la API.
- Conectar `Client4`, la acción de Redux y el punto de confirmación del buscador.
- Agregar pruebas de registro, deduplicación, retención y manejo de errores.

**Dependencia:** TT-01.

## HU-02 — Consultar las búsquedas recientes

> Como usuario, quiero ver mis búsquedas recientes al abrir el buscador para encontrar rápidamente una consulta anterior.

### Criterios de aceptación

- Se muestran hasta cinco entradas, ordenadas de la más reciente a la más antigua.
- Aparecen debajo de las opciones de búsqueda.
- El desplegable tiene una altura máxima de 550 px y se adapta a pantallas más pequeñas.
- El historial se recupera después de recargar la página o volver a iniciar sesión.
- Si no hay entradas, el buscador mantiene sus opciones habituales sin mostrar una lista vacía.
- Un error al cargar el historial no impide utilizar el buscador.

### Trabajo técnico

- Implementar la consulta en `Store`, `App` y API.
- Agregar el método de `Client4`, las acciones, el reducer y el selector de Redux.
- Crear el componente `RecentSearches` e incorporarlo debajo de `SearchBoxHints`.
- Agregar pruebas de orden, cantidad, estado vacío, carga y error.

**Dependencia:** TT-01 para desarrollar con datos simulados; HU-01 para validar el recorrido completo de registro y consulta.

## HU-03 — Ejecutar nuevamente una búsqueda

> Como usuario, quiero seleccionar una búsqueda reciente para repetirla sin escribirla otra vez.

### Criterios de aceptación

- Al seleccionar una entrada, se recuperan su texto, tipo y alcance.
- Se utiliza el flujo existente de búsqueda para presentar los resultados.
- La búsqueda seleccionada pasa al primer lugar del historial.
- Se conservan los operadores originales, como `from:`, `in:` o filtros de fecha.
- Si el equipo o alcance ya no está disponible, se informa al usuario y no se cambia silenciosamente por otro.

### Trabajo técnico

- Conectar la selección con `runSearch` en `new_search.tsx`.
- Validar el contexto guardado antes de ejecutar la consulta.
- Comprobar la compatibilidad con filtros, sugerencias y tipos de búsqueda existentes.
- Agregar pruebas de ejecución, restauración del contexto y actualización de la recencia.

**Dependencias:** HU-01 y HU-02.

## HU-04 — Eliminar una búsqueda reciente

> Como usuario, quiero eliminar una búsqueda del historial para dejar de verla entre mis búsquedas recientes.

### Criterios de aceptación

- Al pasar el cursor sobre una entrada aparece una “x” con el tooltip “Clear”.
- Al pulsarla, se elimina únicamente esa entrada.
- La eliminación no ejecuta la búsqueda ni elimina otras entradas.
- Después de recargar, la entrada eliminada continúa ausente.
- Si la operación falla, la interfaz informa el error y mantiene o recupera un estado coherente.
- El servidor comprueba que la entrada pertenece al usuario que solicita eliminarla.

### Trabajo técnico

- Implementar la eliminación por identificador en `Store`, `App`, API y `Client4`.
- Incorporar la acción de Redux y conectarla con el componente.
- Definir el comportamiento de la interfaz durante la operación y ante un fallo.
- Agregar pruebas de eliminación, persistencia del cambio y autorización.

**Dependencia:** TT-01 para implementar la operación; HU-02 para completar su integración visual.

## HU-05 — Mantener un historial coherente entre sesiones

> Como usuario que utiliza varias sesiones, quiero que mis búsquedas y eliminaciones se reflejen entre ellas sin sobrescribir cambios anteriores.

### Criterios de aceptación

- Una búsqueda registrada en una sesión se refleja en las demás sesiones conectadas del mismo usuario.
- Una eliminación también se refleja en esas sesiones.
- Dos búsquedas distintas realizadas simultáneamente se conservan si están entre las cinco más recientes, según el límite acordado.
- Las operaciones concurrentes respetan la deduplicación y el límite de retención.
- Al reconectar, el cliente vuelve a consultar el estado del servidor.
- Ningún usuario puede consultar o modificar el historial de otro.

### Trabajo técnico

- Aplicar transacciones y coordinación de escrituras por usuario.
- Publicar un evento WebSocket después de confirmar los cambios persistidos.
- Implementar la recepción del evento y la actualización o invalidación del estado Redux.
- Recuperar el historial al reconectar.
- Agregar pruebas de concurrencia, permisos y sincronización entre sesiones.

**Dependencias:** HU-01, HU-02 y HU-04 para validar el flujo completo. La estrategia de concurrencia debe definirse desde TT-01 e implementarse junto con las operaciones de almacenamiento.

## HU-06 — Utilizar el historial mediante teclado

> Como usuario que navega con teclado o lector de pantalla, quiero consultar, ejecutar y eliminar búsquedas recientes de forma accesible.

### Criterios de aceptación

- Las acciones de seleccionar y eliminar son accesibles mediante teclado.
- El control de eliminación también aparece al recibir foco.
- Los controles tienen nombres accesibles que permiten identificar su función.
- Al eliminar una entrada, el foco queda en una ubicación válida y predecible.
- Se mantienen el cierre con Escape y la navegación existente del buscador.
- Los textos usan el mecanismo de traducción del repositorio y los estilos respetan el tema.

### Trabajo técnico

- Definir la semántica de los controles y la gestión del foco.
- Utilizar los componentes compartidos pertinentes, incluido `WithTooltip`.
- Incorporar los textos mediante `react-intl` y seguir las convenciones de estilos del frontend.
- Agregar pruebas de interacción mediante teclado y nombres accesibles.

**Dependencia:** contrato del componente de HU-02. Debe desarrollarse junto con la interfaz; su validación completa requiere HU-03 y HU-04.

## Reparto entre los cuatro integrantes

| Integrante | Responsabilidad principal | Historias | Entregables |
|---|---|---|---|
| **1 — Persistencia y dominio** | Modelo, migración, SQL, reglas de `App`, deduplicación, retención y transacciones. | HU-01, HU-04 y HU-05; consulta necesaria para HU-02. | Almacenamiento y reglas del servidor, con pruebas de persistencia y concurrencia. |
| **2 — API y estado del cliente** | Endpoints, permisos, `Client4`, acciones, reducer, selectores y recepción de eventos WebSocket. | HU-01, HU-02, HU-04 y HU-05. | Contrato integrado entre servidor y cliente, con pruebas de API y estado. |
| **3 — Buscador e interfaz** | Componente de recientes, estilos, integración con `runSearch`, selección y eliminación. | HU-02, HU-03 y HU-04. | Interfaz integrada y pruebas de componentes. |
| **4 — Accesibilidad y validación completa** | Implementación de teclado y foco, ampliación de los componentes de pruebas de Playwright y escenarios E2E. | HU-06 y validación transversal. | Interacción accesible, pruebas de extremo a extremo y evidencias para el PR. |

Las historias atraviesan varias capas y requieren colaboración. Cada integrante entrega pruebas de su propia implementación. El integrante 4 prepara los escenarios desde el inicio y valida el recorrido completo; no concentra todas las pruebas del equipo.

Para reducir conflictos, el integrante 3 coordina los cambios en `new_search.tsx` y `search_box.tsx`. Los integrantes 3 y 4 acuerdan qué archivos o componentes modifica cada uno para la interacción accesible.

## Orden de ejecución

1. **Cerrar TT-01:** contrato, reglas, migración, concurrencia y datos simulados.
2. **Avanzar en paralelo:** almacenamiento; API y Redux; interfaz con datos simulados; preparación de escenarios y accesibilidad.
3. **Primera integración:** registrar y consultar búsquedas mediante HU-01 y HU-02.
4. **Completar las interacciones:** ejecutar y eliminar mediante HU-03 y HU-04, incorporando HU-06.
5. **Validar múltiples sesiones:** completar HU-05 y comprobar concurrencia, reconexión y permisos.
6. **Revisión cruzada y entrega:** corregir incidencias, ejecutar los controles pertinentes y preparar el PR.

## Definición de terminado

- La historia funciona de extremo a extremo y cumple todos sus criterios de aceptación.
- Las reglas de negocio y las operaciones de almacenamiento tienen pruebas pertinentes.
- Los componentes tienen pruebas con Jest y React Testing Library, usando las utilidades del repositorio.
- Los flujos principales y sus regresiones están cubiertos con Playwright.
- Se verificaron los casos de error, autorización y concurrencia aplicables.
- Pasan los controles de tipos, estilos y traducciones correspondientes a los archivos modificados.
- La migración se verifica sobre una instalación nueva y sobre un esquema que incluya la tabla heredada.
- El PR sigue `.github/PULL_REQUEST_TEMPLATE.md` e incluye evidencias visuales y una nota de versión que describa la funcionalidad.

## Referencias del repositorio

- [Instrucciones generales](AGENTS.md).
- [Instrucciones del servidor](server/AGENTS.md).
- [Instrucciones del frontend](webapp/AGENTS.md) y [guía de estilo](webapp/STYLE_GUIDE.md).
- [Coordinación del buscador](webapp/channels/src/components/new_search/new_search.tsx).
- [Composición del cuadro de búsqueda](webapp/channels/src/components/new_search/search_box.tsx).
- [Acciones de búsqueda y resultados](webapp/channels/src/actions/views/rhs.ts).
- [Interfaces de almacenamiento](server/channels/store/store.go).
- [Migración heredada de búsquedas recientes](server/channels/db/migrations/postgres/000084_recent_searches.up.sql).
- [Recepción de eventos WebSocket](webapp/channels/src/actions/websocket_actions.ts).
- [Componente de pruebas de Playwright para el buscador](e2e-tests/playwright/lib/src/ui/components/channels/search_box.ts).
- [Plantilla de pull request](.github/PULL_REQUEST_TEMPLATE.md).