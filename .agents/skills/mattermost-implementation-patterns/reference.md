# Mattermost implementation reference

Detailed patterns for agents. Read sections as needed; do not load entirely unless implementing that layer.

## api4 handler template

Pattern from `server/channels/api4/drafts.go` and `post.go`:

```go
func (api *API) InitExample() {
    api.BaseRoutes.Channel.Handle("/example", api.APISessionRequired(getExample)).Methods(http.MethodGet)
}

func getExample(c *Context, w http.ResponseWriter, r *http.Request) {
    // Permission check
    if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionReadChannel) {
        c.SetPermissionError(model.PermissionReadChannel)
        return
    }

    result, err := c.App.GetExample(c.AppContext, c.Params.ChannelId)
    if err != nil {
        c.Err = err
        return
    }

    if err := json.NewEncoder(w).Encode(result); err != nil {
        c.Logger.Warn("Error while writing response", mlog.Err(err))
    }
}
```

Mutating handlers also:

- Build `auditRec := c.MakeAuditRecord(model.AuditEvent..., model.AuditStatusFail)` and `defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)`
- Use `model.AddEventParameterAuditableToAuditRec` for auditable payloads
- Call shared `*Checks(c, ...)` helpers when the same validation applies to multiple entry points (see `createPostChecks` in `post.go`)

## Permission helpers

Common patterns in `api4`:

- `c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channelId, model.PermissionCreatePost)`
- `c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)`
- On failure: `c.SetPermissionError(model.PermissionXxx)` then `return`

Keep permission checks in `api4` for HTTP entry points; `app` should re-check when the same function is called from jobs, plugins, or cluster handlers.

## app layer

- Methods live on `*App` in `server/channels/app/*.go`
- First parameter is `request.CTX` (often `rctx`) for logging and tracing
- Return `(*T, *model.AppError)` or `(T, *model.AppError)` for operations exposed to API
- Delegate persistence to `a.Srv().Store().Entity().Method(...)`
- Side effects: WebSocket `Publish`, webhooks, jobs — follow neighboring methods in the same file
- Plugin hooks: run via app helpers before/after persistence; never let plugins skip permission checks that already ran

## store layer

| Piece | Location |
|-------|----------|
| Interface | `server/channels/store/store.go` (`PostStore`, etc.) |
| Implementation | `server/channels/store/sqlstore/*_store.go` |
| Tests | `server/channels/store/storetest/*_store.go` |

Conventions:

- Struct name `SqlPostStore`, receiver `(s *SqlPostStore)`
- Mutations take `request.CTX` as first arg after receiver
- Return Go `error` from store; convert to `*model.AppError` in `app`
- New queries: check `server/channels/README.md` — avoid extra round trips, run `EXPLAIN ANALYZE` on large tables for new SQL

## model and errors

- Shared types: `server/public/model/`
- User-facing errors: `model.NewAppError(where, "api.entity.error_id", nil, detail, httpStatus)`
- Add new permission constants alongside existing `Permission*` in model when introducing new capabilities

## api4 tests

- Package `api4_test` or `api4` depending on file; follow the file being extended
- `th := Setup(t)` / `th := SetupConfig(t)` patterns in `api4/main_test.go`
- Use `th.Client`, `th.App`, `th.BasicUser`, `th.BasicChannel` helpers
- Assert HTTP via `th.Client` or `th.DoAPI*` helpers; assert app state via `th.App` and `require`

## Webapp: Redux action template

```typescript
import {bindClientFunc} from 'mattermost-redux/actions/helpers';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';

import {General} from 'mattermost-redux/constants';

export function fetchExample(channelId: string): ActionFuncAsync<ExampleType> {
    return bindClientFunc({
        clientFunc: (client) => client.getExample(channelId),
        onSuccess: (data, dispatch) => {
            dispatch({
                type: ExampleTypes.RECEIVED,
                data,
                channelId,
            });
            return {data};
        },
    });
}
```

- Export thunks from `webapp/channels/src/actions/` or colocated `actions.ts` next to a feature
- Use `ActionFuncAsync<T>` return type
- Memoize selectors with `createSelector`; factories named `makeGet...` when parameterized

## Webapp: component template

```
components/feature_name/
  feature_name.tsx
  feature_name.scss
  feature_name.test.tsx
  index.ts          # optional barrel
```

```tsx
import React, {useCallback} from 'react';
import {useSelector, useDispatch} from 'react-redux';
import {FormattedMessage} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';

import './feature_name.scss';

function FeatureName() {
    const dispatch = useDispatch();
    const someValue = useSelector(getSomeSelector);

    const handleClick = useCallback(() => {
        dispatch(fetchExample(someValue));
    }, [dispatch, someValue]);

    return (
        <div className='FeatureName'>
            <FormattedMessage
                id='feature_name.title'
                defaultMessage='Title'
            />
            <Button onClick={handleClick}>
                <FormattedMessage
                    id='feature_name.action'
                    defaultMessage='Go'
                />
            </Button>
        </div>
    );
}

export default React.memo(FeatureName);
```

## Client4

Add methods in `webapp/platform/client/src/client4.ts` (or the module where siblings live):

- Mirror REST path and verb from `api4`
- Use `this.doFetch` / `this.get` / `this.post` patterns from neighboring methods
- Only call from Redux actions, not components

## OpenAPI (api/)

| Change | File |
|--------|------|
| New route | Domain yaml under `api/v4/source/` (e.g. `posts.yaml`) |
| New schema | `api/v4/source/definitions.yaml` |
| New tag | `api/v4/source/introduction.yaml` |

Build: `cd api && make build && make run` for local preview.

## Migrations (quick reference)

```
server/channels/db/migrations/postgres/000185_description.up.sql
server/channels/db/migrations/postgres/000185_description.down.sql
```

Then `make migrations-extract` from `server/`.

Rules (see full README):

- Additive > destructive; backwards compatible until last ESR
- `CREATE INDEX CONCURRENTLY` in separate non-transactional migration when required
- No full-table `UPDATE`; batch in jobs
- Column type changes: multi-release phased approach

## Commands (common)

| Task | Command (from repo root or subdir) |
|------|-------------------------------------|
| Server unit tests | `cd server && go test ./channels/api4 -run TestName` |
| Store tests | `cd server && go test ./channels/store/storetest -run TestName` |
| Webapp unit tests | `cd webapp && npm test -- --testPathPattern=feature_name` |
| i18n extract | `cd server && make i18n-extract` |
| modules tidy | `cd server && make modules-tidy` |
| migrations list | `cd server && make migrations-extract` |

## End-to-end example map (for navigation)

When tracing “create post” or similar flows:

| Step | Location |
|------|----------|
| Client4 | `webapp/platform/client` — `createPost` |
| Redux | `webapp/platform/mattermost-redux/src/actions/posts.ts` |
| API route | `server/channels/api4/post.go` — `InitPost`, `createPost` |
| App | `server/channels/app/post.go` — `CreatePost` |
| Store | `server/channels/store/sqlstore/post_store.go` — `Save` |
| WS client | `webapp/channels/src/actions/websocket_actions.ts` |
| Plugin hook | `server/public/plugin/hooks.go` — `MessageWillBePosted` |

Use this map to find analogous files for other entities (channels, users, drafts, etc.).
