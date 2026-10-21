# User stories enriquecidas — issue #15976

- **Origen:** `user_stories.md` (no se modificó).
- **Issue:** [Allow users to access recent searches](https://github.com/mattermost/mattermost/issues/15976) (MM-28251).
- **Generado por:** `/enrich-us`.
- **Siguiente paso:** `/ff recent-searches`.

## Original

Fuente: `user_stories.md`.

Epic: el usuario consulta, reejecuta y elimina hasta 5 búsquedas recientes (mensajes/archivos), persistidas en servidor, coherentes entre sesiones. Plugins fuera de alcance.

Arquitectura propuesta: React → Redux → Client4 → API → App → Store → SQL. Fechas, deduplicación y retención en servidor. WebSocket para otras sesiones.

- **TT-01:** contrato, migración (sin tocar `000084_recent_searches`), límite, eventos, mocks.
- **HU-01:** registrar al confirmar búsqueda.
- **HU-02:** listar bajo hints; max-height 550px; vacío/error no rompen el buscador.
- **HU-03:** clic reejecuta `runSearch` y sube recencia; alcance inválido no se silencia.
- **HU-04:** “x” + tooltip “Clear”; auth por dueño.
- **HU-05:** sync entre sesiones + concurrencia.
- **HU-06:** teclado, foco, `react-intl`, tema.

Reparto en 4 integrantes. DoD de epic: Jest/RTL, Playwright, migración nueva y legacy, PR template.

**Huecos que cerró el enriquecimiento:** URLs/status codes, tipos de campos, nombre de tabla nueva, evento WS, archivos de store/api4/redux, TT-01 cerrado.

## Enhanced

**Veredicto:** lista para planificación de equipo; **no** para `/apply` autónomo hasta usar este contrato. Las decisiones de TT-01 quedan **propuestas y cerradas para implementación** (cambiarlas solo si el equipo discrepa).

### TT-01 cerrado (contrato compartido)

| Decisión | Valor |
|---|---|
| Límite almacenado y mostrado | **5** por usuario (el issue solo exige 5 en UI; unificar evita divergencia) |
| Tipos persistidos | `messages`, `files`. Plugins: no se guardan |
| Tabla nueva | `recentsearchqueries` (no reutilizar `recentsearches`) |
| Migración histórica | `000084_recent_searches` **no se edita**. Nueva: `000233_create_recent_search_queries` |
| Deduplicación | `(user_id, terms, search_type, team_id)` tras `strings.TrimSpace`; no reescribir operadores (`from:`, `in:`, fechas) |
| Recencia | `update_at` asignado **solo en servidor** (`model.GetMillis()`) |
| `team_id` | ID de equipo o `""` = búsqueda cross-team / “todos” |
| Registro | Una sola vez en `runSearch` de `new_search.tsx`, **después** de disparar la búsqueda; fire-and-forget |
| No registrar | términos vacíos; tecleo; sugerencias; paginación; tipo plugin |
| Fallo de historial | la búsqueda **sigue**; log + error de UI no bloqueante |
| Auth | solo el usuario de la sesión (`user_id` = session o `me`). 403 si otro id |
| Concurrencia | transacción por `user_id`: upsert por clave de dedup → si hay >5, borrar las más antiguas |
| Reconexión | GET al reconectar WS; no confiar solo en el evento |

### Modelo

```go
type RecentSearch struct {
    Id         string `json:"id"`          // 26-char Mattermost ID
    UserId     string `json:"user_id"`
    Terms      string `json:"terms"`       // max 2048 runes
    SearchType string `json:"search_type"` // "messages" | "files"
    TeamId     string `json:"team_id"`     // team id or ""
    CreateAt   int64  `json:"create_at"`
    UpdateAt   int64  `json:"update_at"`   // last used; sort DESC
}
```

Errores: `400` validación; `401` sin sesión; `403` otro usuario; `404` delete de id inexistente o ajeno (tratar ajeno como 404 para no filtrar existencia).

### API (`/api/v4`)

| Método | URL | Body / query | 200 |
|---|---|---|---|
| `POST` | `/users/{user_id}/recent_searches` | `{terms, search_type, team_id}` | `RecentSearch` (creada o actualizada) |
| `GET` | `/users/{user_id}/recent_searches` | — | `{items: RecentSearch[]}` máx. 5, `update_at` DESC |
| `DELETE` | `/users/{user_id}/recent_searches/{search_id}` | — | `{"status":"ok"}` |

Rutas en `server/channels/api4` sobre `BaseRoutes.User`. Session required. Sin permiso de system admin para leer historial ajeno.

### WebSocket

- Evento: `recent_search_updated`
- Broadcast: **solo sesiones del usuario**
- Payload: `{action: "created"|"updated"|"deleted", item?: RecentSearch, id?: string}`
- Cliente: invalidar/actualizar reducer; si el payload es incompleto, GET.

### Archivos a tocar

**Servidor**

- `server/public/model/recent_search.go` (nuevo)
- `server/public/model/websocket_message.go` — constante del evento
- `server/channels/store/store.go` — `RecentSearch() RecentSearchStore`
- `server/channels/store/sqlstore/` — implementación + `make store-mocks` / `make store-layers`
- `server/channels/db/migrations/postgres/000233_create_recent_search_queries.{up,down}.sql`
- `server/channels/app/recent_search.go` (nuevo)
- `server/channels/api4/recent_search.go` + `api.go` (registro de rutas)
- Tests: `*_test.go` en store, app, api4

**Cliente**

- `webapp/platform/client/src/client4.ts` — 3 métodos
- `webapp/platform/types` — tipo `RecentSearch`
- `webapp/channels/src/packages/mattermost-redux` — actions/reducer/selectors
- `webapp/channels/src/actions/websocket_actions.ts`
- `webapp/channels/src/components/new_search/new_search.tsx` — persistir en `runSearch`
- `webapp/channels/src/components/new_search/search_box.tsx` — montar lista bajo hints
- `webapp/channels/src/components/new_search/recent_searches.tsx` (nuevo)
- i18n: `make i18n-extract` en webapp
- Playwright: `e2e-tests/playwright/lib/src/ui/components/channels/search_box.ts` + spec nueva

**Coordinación de conflictos:** integrante 3 es dueño de `new_search.tsx` y `search_box.tsx`.

### HU-01 — Registrar las búsquedas realizadas

Al confirmar en `runSearch` (`messages`/`files`, terms no vacíos) → `POST`. Servidor upsert + retención a 5. UI no espera el POST para mostrar resultados.

**DoD:** tests de upsert, trim, no-plugin, retención, 403; la búsqueda continúa si el POST falla.

**NFR:** POST < 200 ms p95 en local; no bloquear UI.

### HU-02 — Consultar las búsquedas recientes

Al abrir el popover → `GET` (o cache Redux). Lista bajo `SearchBoxHints`; 5 ítems; `max-height: 550px`; sin filas si `items=[]`. Error de GET: buscador usable.

**DoD:** Jest orden/límite/vacío/error; persistencia tras reload.

### HU-03 — Ejecutar nuevamente una búsqueda

Click/Enter en ítem → `runSearch(search_type, team_id, terms)`. Si `team_id` no está en `getMyTeams` y no es `""`, toast/mensaje y no cambiar de equipo. El POST de HU-01 actualiza recencia.

**DoD:** operadores intactos; team inválido visible.

### HU-04 — Eliminar una búsqueda reciente

Hover o foco → `x` + `WithTooltip` “Clear”. Click/Delete no dispara search. `DELETE` + quitar del reducer. Fallo: revertir o refetch + error.

**DoD:** 404/403; persistencia tras reload.

### HU-05 — Mantener un historial coherente entre sesiones

Tras commit SQL, publicar WS. Otra pestaña aplica payload o GET. Dos POSTs concurrentes distintos: ambas quedan si caben en top-5.

**DoD:** test de transacción/retención; no leak entre users.

### HU-06 — Utilizar el historial mediante teclado

Lista `role="listbox"` / opciones focuseables; delete con tecla y botón visible en `:focus-visible`; foco tras borrar a la siguiente o al input; Escape cierra como hoy. Cadenas `react-intl`.

**DoD:** RTL teclado + Playwright del flujo HU-02/03/04.

### Fuera de alcance (v1)

Historial de búsquedas de plugins; editar una entrada; historial global/admin; migrar filas de `recentsearches` (tabla unused, schema incompatible).

### NFRs transversales

- **Seguridad:** session auth; nunca devolver historial de otro user; no loguear `terms` en info.
- **Observabilidad:** log debug de fallos store/API con `request.CTX`; sin PII de la query.
- **i18n/tema:** `make i18n-extract`; estilos con tokens del tema.
- **Docs:** OpenAPI/api si el cambio toca contratos públicos; release note en el PR.

### Definition of done (epic)

- Las 6 HUs cumplen CA + contrato de esta sección.
- Migración 000233 OK en DB limpia y en DB que ya tiene `recentsearches`.
- `make store-mocks` / `make store-layers` regenerados.
- Tests store/app/api4 + Jest/RTL + Playwright de registro/lista/re-run/clear.
- PR con `.github/PULL_REQUEST_TEMPLATE.md`, screenshots y release note.
