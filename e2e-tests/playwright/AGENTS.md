# AGENTS.md

## Parallelism: 1 worker per server, many servers in parallel

Playwright runs with a single worker per server (`PW_WORKERS` defaults to `1`
in `lib/src/test_config.ts`): tests execute serially against any one server,
never concurrently, since many specs mutate shared server-wide state (feature
flags, config, licenses).

CI parallelizes across jobs instead: each job in the `workers` matrix
(`e2e-tests-playwright-template.yml`) boots its own Testcontainers server and
runs its own single-worker Playwright process (`dispatch-run`), pulling spec
files off a shared queue. The suite runs many servers in parallel, but always
one worker per server -- never multiple workers sharing one server.

Don't use `test.describe.configure({mode: 'parallel'})` or assume two tests in
different files could race: they never do within a job.

## `ensureFeatureFlag`: one server restart per spec file

`pw.ensureFeatureFlag(flagName, value)` / `pw.ensureFeatureFlag({flagA: true,
flagB: false})` (`lib/src/server/feature_flags.ts`) restarts the Testcontainers
server with the given `MM_FEATUREFLAGS_*` env vars when it isn't already
running with them. Feature flags can't be changed via `patchConfig` on a
running server, so a restart is the only way to flip one.

- Call it at the top of every test that needs it, inside the test body -- not
  from a bare top-level call or `test.beforeAll()`. `pw` is a test-scoped
  fixture (depends on per-test `page`/`context`) and isn't available in
  `beforeAll`.
- Every test in a spec file must request the same flag combination. When the
  server already matches, this is a no-op, so a file restarts at most once, on
  its first test. Mixing combinations causes a restart on every change.
- A test needing a different combination belongs in its own file. See
  `specs/functional/channels/categories/managed_categories_flag_off.spec.ts`
  and
  `specs/functional/system_console/global_attributes/global_attributes_listing_classification_markings.spec.ts`.

- Before the first test of each spec file, the test fixture restarts the server
  with the env a fresh boot gets (`ensureDefaultServerEnv`), dropping every
  `MM_*` var an earlier file set (feature flags, `ensureMinio()`,
  `ensureOpensearch()`, ...), so a spec only sees what it requests itself. Don't
  rely on leftovers. Consecutive files that request the same non-default env each
  pay a restart to clear and set it.

This is enforced by review, not tooling.

## `ensurePhase2MigrationCompleted`: only for specs that use schemes

The server is ready once `/api/v4/system/ping` answers; the permissions migration
(`lib/src/server/migrations.ts`) is not waited for at boot. Scheme endpoints
(`createScheme`, `updateTeamScheme`, ...) return 501 until it finishes, so a spec
that calls them runs `await pw.ensurePhase2MigrationCompleted()` first. It starts
the migration through `mmctl --local` instead of waiting for the server's 60s
scheduler.

## Licensing

Use `await pw.skipIfNoLicense()` to skip a test when the server has no
license.

## Writing specs with the generated surface

Specs reach the webapp through page objects generated from its testids into `lib/src/ui/generated`, from the committed
report `lib/surface/webapp.surface.json`. Never write or edit a page object by hand: the directory is generated and
ignored by git, and `npm run tsc --workspace @mattermost/playwright-lib` regenerates it. When a spec needs an element
the surface doesn't have, give the element a testid in the webapp ([webapp AGENTS.md](../../webapp/AGENTS.md)) and
rescan ([the tool README](test-surface/README.md)).

```ts
import {Api, App, Msg, expect, settle, test, waitForApi} from '@mattermost/playwright-lib';

const app = new App(page);
await app.teamPage.goto({team}); // and waits for the page's ready element, when the report gives it one
```

### Acting and observing

An action (`click`, `check`, `select`, `press`, `chooseFiles`, ...) resolves to nothing: the spec says what it leads to.
Observe every action before the next one, in one of these ways:

- **It saves**: `settle` waits for the request the action sends and resolves to its typed body. `wait` is required;
  add `params` to count only one entity's request, and `query` only when two requests of one operation differ by their
  query string (`{in_team: team.id, not_in_channel: null}`). `count` waits for that many requests (one per uploaded
  file); `status` expects exactly that status instead of a 2xx (negative tests).

    ```ts
    await settle(removeModal.confirmButton, {wait: Api.RemovePlugin, params: {plugin_id: key}}).click();
    ```

- **It leads somewhere**: `clickTo(destination)` and `pressTo(key, destination)` act and wait for the destination to
  show, and fail at once if it was already visible. A destination is an element, a scope with an element of its own
  (one the generator gives a `container`), or a page that has a ready element, with its path params; a page waits for
  its path and its ready element together. A scope that is only a testid prefix never arrives: target one of its
  members. One `timeout` covers the check, the action and the wait. Each resolves to the destination it was given.

    ```ts
    const settings = await app.globalHeader.settingsButton.clickTo(app.userSettingsModal);
    await app.center.postCreate.message.container.pressTo('ControlOrMeta+K', app.quickSwitchModal);
    ```

- **It changes what is shown**: a retrying `expect` on what changed: `toBeVisible`, `toHaveText`,
  `toHaveMessage(Msg.x)`, `toBeOn`, `toBeSaved`, and the list matchers below. `expect` takes drivers and scopes
  directly, and a failure names the testid and the component that renders it.

- **It needs both a request and a destination**, or the page sends a request by itself: `waitForApi` arms a wait. Put
  every waiter first and exactly one action last in one `Promise.all`. It takes `params` and `query` as `settle` does,
  and a `predicate` skips responses until one holds.

    ```ts
    await Promise.all([waitForApi(page, Api.SearchAccessControlPolicies), policies.searchTextbox.fill(policyName)]);
    ```

The preparing verbs (`fill`, `clear`, `type`, `hover`, `focus`) may be followed by another action without an
observation: filling a field and then saving is one step. `press` takes a key sequence (`press('ArrowDown', 'Enter')`)
as one action.

Buttons, links and menu items click, and so do text, groups and plain containers (a post, a row): click through the
driver, never through `.locator.click()`. `click` takes Playwright's click options (`row.container.click({button:
'right'})`, `{modifiers: ['Alt']}`); `clickTo` takes only its `timeout`. A driver that holds state keeps its own verb: a
tab is selected with `select()`, a checkbox with `check()`.

### Keyed parts and lists

A part rendered once per entity is keyed: its accessor takes the key, or the entity it is keyed by
(`app.admin.sidebar.category('site').section('users_and_teams').titleLink`, `postList.post({id})`), and its members are
found inside that item only. Its list (`postList.postList`, `tokenList`) reads `keys()`, `first()`, `last()`,
`keyWith(filter)` and `itemWith(filter)`, where a filter is `{text}`, `{message: Msg.x, values}` or `{has}`, and takes
the matchers `toHaveKeys`, `toContainKeys` and `toHaveKeyCount`. Position-keyed lists have number keys. A part a mount
never renders is `NotRendered`: it has no verbs or matchers, so using it fails to compile.

### File inputs

A file input is a `FileInputDriver`: `chooseFiles(path)` or `chooseFiles([pathA, pathB])` sets the files without
opening the system picker. Settle the upload, with `count` when several files each send their own request:

```ts
await settle(app.center.postCreate.uploadInput, {wait: Api.UploadFile}).chooseFiles(path.resolve('asset/sample.png'));
```

### The lint rules

Specs and flows are linted with types, so an action is recognized by what it is called on:

- `test-surface/e2e-no-floating-actions`: await every action and every retrying assertion (or return it, or make it
  the one action in a `Promise.all`). An action that isn't awaited runs past the next line; an assertion that isn't
  awaited checks nothing.
- `test-surface/e2e-observe-actions`: observe each action, as above, before the next action and before the function
  turns away from the page (another awaited call, a `return`, its end). Reading the page is turning away too:
  `await row.text()`, `count()`, `waitFor()` or `page.waitForURL()` right after an action is reported, so assert with
  a retrying `expect` instead (`toHaveText`, `toHaveCount`, `toBeVisible`, `toHavePath`). A helper that acts and
  returns before observing is reported too: end it with a `settle`, a `clickTo`/`pressTo` or an `expect`.
- `test-surface/e2e-disable-reason`: disabling either rule names it and says why:
  `// eslint-disable-next-line test-surface/e2e-observe-actions -- <reason>`. A bare disable is an error.

### When a scoped `.locator` is allowed

Act and assert through drivers; reach for `.locator` only for what the surface cannot describe: content without a
generated member (a heading inside a dialog, an avatar image, rendered markdown), state without an ARIA attribute (a
selected-row class), or UI a plugin renders itself, which is outside the scanned webapp. Start from the nearest
generated scope or driver, never from `page`, and say why on the line above:

```ts
// Keyboard highlight has no ARIA state; check the selected row inside the declared results.
await expect(people.results.locator.locator('.more-modal__row--selected')).toHaveCount(1);
```

When the element should be part of the surface, prefer adding a testid in the webapp.
