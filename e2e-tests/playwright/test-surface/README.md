# Test surface

`@mattermost/test-surface` scans the application's `data-testid` declarations and generates typed Playwright page objects. Product code declares the surface; specs use the generated API. Do not edit generated files or write replacement page objects by hand.

The committed **version 4 report** describes families, concrete scopes, parts, keys, pages, plugin slots and the complete client API catalog. It contains structure only. It does not predict requests, opened components or navigation from handlers. Specs state their waits and destinations explicitly.

## Scan a project

Use Node 24.11 or newer. Install the scanned project's dependencies before scanning: the scanner loads TypeScript from the tsconfig location and follows its installed types. Pass the project's surface config explicitly:

```sh
node test-surface/bin/test-surface.mjs scan --config /path/to/config.json
node test-surface/bin/test-surface.mjs generate --config /path/to/config.json
node test-surface/bin/test-surface.mjs check --config /path/to/config.json
```

`scan` writes the configured version 4 report when the app has no scan errors. Commit it with the source/config change. `generate` reads that report and writes the SDK; generated files must be regenerated, not edited. `check` fails on scan errors or a report that differs from a fresh scan, without updating it. The consuming Playwright library owns its runtime compilation and integration commands.

Invalid configs, compiler options and syntax errors stop analysis. Semantic TypeScript errors do not stop a scan of a partially typed program; a successful scan is not a substitute for the project's compiler gate.

## Declare testids

The grammar is `scope.name[:key][--role]`. Path words match `[a-z][a-z0-9_]*`; dots separate scope/name words. The optional key follows the first colon, and an optional role suffix follows the key. Keys are raw identity values: do not escape, lowercase or otherwise rewrite them to fit path-word syntax. Dots in plugin IDs or config-path keys stay in the key.

```tsx
<button data-testid='channel_settings.save--button'/>
<li data-testid={`post_list.post:${post.id}--listitem`}/>
<span data-testid='channel_settings.title--text'/>
<input type='file' data-testid='composer.upload'/>
```

The suffix selects the generated driver: `--button`, `--link`, `--text`, and container kinds can click or read any element. State and input kinds (`--checkbox`, `--textbox`, `--combobox`, and similar) require the native or ARIA semantics their driver reads. `--textbox` and `--searchbox` use typing capability: fillable native text inputs, textareas and editable elements fit even when their ARIA role is `combobox`. `--spinbutton` uses a numeric input or editable element. A role on a noneditable div does not make it fillable. A button exposing pressed state uses `--togglebutton`. Accessibility auditing is outside this tool. A scope root can omit the suffix. A bare top-level word with no declared members is not a scope; a component that declares only one element is a part of the enclosing scope. The parser and complete suffix list are in [lint/grammar.js](lint/grammar.js).

A shared component takes its optional scope prefix in `testIdScope` (or `testId` when that prop also names its own element). Pass only the scope in `testId`/`testIdScope`, with no key or role; derive member IDs with literal suffixes. Guard an absent scope so it produces `undefined`:

```tsx
<button data-testid={testId ? `${testId}.save--button` : undefined}/>
```

For repeated items, pass the identity separately from the scope. Put the key on the item's own element; its descendants retain their member paths and are found within that item. Use one key kind for each name: split names when one set of mounts uses an entity ID and another uses a fixed set. Never concatenate multiple identities into a composite key.

Keys must resolve to an entity field, a fixed literal set, a position/index, or a supported canonical value declaration. An unresolved plain `string` is an error. Do not key by translated labels, display text or mutable content. A native file input needs its own role-free testid and becomes a `FileInputDriver`; it cannot have its own key or be a family's container. A repeated upload belongs as a plain file-input part inside the repeated item's family.

Rows use text drivers: a row does not imply an action; an actionable cell or member has its own driver.

A scope prefix does not imply a DOM element. An element-only menu can be a `ContainerDriver` part, used directly, while a namespace-only menu family has no `container`. `clickTo`/`pressTo` accept a scope only when its own container is rendered at that mount; otherwise target a real member. Portal metadata controls where generated lookups start and says nothing about what an action opens.

## Configure the scan

The full schema is [src/config.ts](src/config.ts). Paths in a config belong to the project consuming the tool.

Most paths, including `tsconfig`, `include`, `entries`, `entityTypeDirs`, `client.file`, `openapiDir`, `actionLintRoots` and output paths, are relative to the config file's directory. `root` controls the project-relative locations printed in diagnostics. Library `parts` paths, plugin manifest/host paths and `pageSections.from.file` are relative to `root`.

`entityTypeModules` maps config-relative entity directories to their public package import prefixes, for example `{"../../types/src": "@acme/types"}`. It applies to entity keys and client response body types together; an omitted prefix defaults to `@mattermost/types`.

| Setting | Purpose |
| --- | --- |
| `root`, `tsconfig`, `include`, `exclude`, `pathOverrides` | Select the program and scanned source files; resolve workspace packages to their source. |
| `entries` | Identify application entry modules; testids outside their import closure get no generation or checks and are listed in `reports/not_reachable.txt`. |
| `entityTypeDirs` | Identify entity declarations used to prove key origins. |
| `client`, `openapiDir` | Build the full typed `Api` catalog, including operations not currently used by rendered controls. Method plus canonical path must be unique; placeholder names do not distinguish paths. |
| `checks.keyFields` | Set the id-like field pattern and declare other stable identity fields with reasons. Local types require an import-specifier `module` (for example `components/post_emoji/post_emoji`), resolving the type's declaration by symbol; declared entity types can omit it. A missing or unused declaration is an error. |
| `keyValues` | Declare canonical value-key helpers as `{function: "dayKey" \| "timeKey", module: "import-specifier"}`. The function must resolve uniquely; unresolved or unused entries are errors. |
| `familyNames`, `setNames` | Resolve generated export-name collisions without changing product identities. |
| `pageNames`, `pageParams`, `pageSections` | Name pages and their route parameters/sections. |
| `pageReady` | Declare real ready testids for a page, or `{ "ready": null, "reason": "…" }` when none exists. Readiness is not inferred; a page without a ready witness is not an action destination. |
| `generateScopes` | Optionally limit generated output to named scopes. It does not make invalid declarations valid. |
| `output.report`, `output.generated`, `output.runtime`, `output.reports` | Select the committed report, ignored SDK output, runtime import and ignored diagnostic directory. |
| `checks.strictPaths`, `checks.strictScopes`, `checks.allow`, `checks.strictExceptions` | Control diagnostic severity and reasoned exceptions. Remove stale exceptions; their counts are budgeted. Keys remain strict. |
| `staleReferences` | Check configured test directories for references to testids no scanned template can render. |
| `checks.strictExceptionWarningCeiling` | Maximum warning count covered by `strictExceptions`, independent of the number of exception entries. Set the current legacy count and lower it as findings are removed. Additional warnings fail the scan. |
| `lookupPortals` | Host exports that portal their children: `{from, name, reason}`. `from` is an imported module or a source file relative to `root`; `name` is its export name (`default` is allowed). Export symbols preserve aliases and distinguish same-named local components. This only chooses lookup roots. Direct resolved `createPortal` wrappers are inferred; known opaque portal imports without a declaration are scan errors. |
| `libraries`, `library` | Read published component parts, or extract a library's own parts with `parts`. |

An identity declaration needs a reason tied to the data, for example:

```json
{
  "checks": {
    "keyFields": {
      "allow": [
        {
          "entity": "Props",
          "module": "components/post_emoji/post_emoji",
          "field": "name",
          "value": "emoji",
          "reason": "A markdown emoji is identified by its name, read from parsed HTML."
        }
      ]
    }
  }
}
```

An allow entry can name a type outside `entityTypeDirs` when `module` identifies its declaration. Use the TypeScript import specifier the program imports. Relative specifiers (`./...`, `../...`) resolve from the tsconfig directory, independently of imports written in other files. Exported library types follow re-exports and aliases; merged declarations of one symbol are one type. Non-exported application types are found in the resolved declaring file. The scanner stops at that declared scalar prop instead of tracing untyped caller values; another module's type with the same name does not match. For keys of a record field (`Object.keys`/`Object.entries`), `keys: true` declares the record's keys and requires a `value` identity name. Use these declarations only when the field really identifies the item, not to suppress an unknown origin.

`keyValues` is for canonical day/time strings, not arbitrary formatting or display text. For example, `{"function": "timeKey", "module": "components/datetime_input/datetime_input"}` identifies the function declared in that module. Module resolution uses the same tsconfig context as `keyFields`; private top-level application helpers need no new export. Import aliases, re-exports, namespace calls and immutable const forwarding retain the function's identity. A shadow function with the same name does not match. Remove entries that no longer supply a rendered key: unused contracts are errors.

An explicit entity-field annotation such as `readonly userId?: UserProfile['id']` also proves the field origin. The entity resolves by symbol to `entityTypeDirs`; the field must be `id` or have its own `keyFields` declaration. Import aliases work, and optional/null alternatives remain missing values unless guarded. Wrapper aliases, casts and unions of different entities do not establish this origin. When replacing a plain-string prop and its config entry, use an existing entity type with a type-only import, preserve optional/null/readonly shape, verify every producer supplies that entity's id, and delete the redundant entry in the same change.

`freeForm: true` declares a stable identity whose spelling can contain arbitrary punctuation. It still needs a proven field origin and a role suffix on the element; it does not admit unresolved strings or translated labels. The golden budgets expose `keyFields` and `freeFormKeyFields` counts separately, so both declaration lists can shrink without allowing growth.

Family names are unique. A scope-specific `familyNames` entry wins over the component name, for example `{"familyNames":{"ConfirmModal":"Confirmation","admin.delete_modal":"DeleteConfirmation"}}`. Fixed sets use their source type/constant name where available; otherwise they use the full element path plus `Key` (`admin.role` becomes `AdminRoleKey`). `setNames` can override the derived name or element path when it clashes.

Webapp testid lint warnings give authors local feedback. CI enforcement comes from scanner `strictPaths` and `strictExceptionWarningCeiling`; the lint directory also triggers the webapp CI workflow.

## Read a scan error

Start with the file, rule and suggested fix in the diagnostic. To find a declaration and the component usages that supply its value:

```sh
node test-surface/bin/test-surface.mjs where 'post_list.post:{key}--listitem' --config /path/to/config.json
node test-surface/bin/test-surface.mjs report --all --config /path/to/config.json
```

`report` writes human-readable diagnostics, locations and `counts.json` to `output.reports` when configured. These files are uncommitted. The committed report contains no source locations, usage chains, diagnostic text or handler effects.

| Rule or failure | Fix |
| --- | --- |
| `grammar`, `unscoped`, `undefined` | Use valid literal path words, supply a meaningful scope, and guard missing optional scope/key values. |
| `role-fit` | State and input drivers need an element with the state or input semantics they read. Click/text/container suffixes work on any element. |
| `key-origin` | Trace the value to an identity field, literal set or index. Add a reasoned stable-field declaration only when warranted; do not cast away the error. |
| `duplicates`, `collisions` | Give concurrently rendered elements distinct names; split incompatible roles/key kinds. Resolve family/set export collisions with `familyNames`/`setNames`. |
| `unresolved`, `truncated` | Read the usage chain and simplify or expose the declaration the scan cannot resolve. Do not silently omit an arm or raise a cap merely to hide it. |
| `pages` | Correct the page name/route declaration or name a ready element that page actually renders. |
| `input` | Fix the named config/input: missing files or libraries, unsupported versions, or unresolved candidate definitions. |
| `plugin-slots`, `plugin-scope`, `plugin-compat` | Align registry methods, plugin scope and host slot contracts. |
| `stale-reference` | Update the test reference after a rename. A missing element is not proved absent by a stale selector. Testids not reachable from configured entries are listed separately and never fail the scan. |
| `allow`, `strict-exceptions` | Remove an exception that no longer matches a problem. |
| Generated TypeScript error | Regenerate first. Namespace-only/absent-root scopes are not destinations; target a rendered member. Helpers accepting several mounts of a family must preserve the binding parameter rather than widen it to one mount or the family's constraint. |

Generated family classes are invariant in their binding parameter. A helper over different mounts is generic, such as `<B extends ConfirmModalBinding>(modal: ConfirmModal<B>)`; its body must still respect which members that binding can render. Exported library helpers need explicit return types that can be named through the public `App` API (for example, `App['userSettingsModal']`), rather than inferred private generated class names. See [src/report_types.ts](src/report_types.ts) for the structural contract.

## Lint, budgets and CI

`@mattermost/test-surface/grammar` exports the parser/roles; `@mattermost/test-surface/lint` exports the ESLint rules; `@mattermost/test-surface/verbs` supplies the shared action vocabulary. The runtime bundles the grammar and verbs when built.

`e2e-observe-actions` requires the last action before the function turns away from the page to be observed (`clickTo`/`pressTo`, `settle`, a retrying assertion, `expect.poll` or `toPass`); actions in a chain need nothing between them, because Playwright waits for the target of each. `e2e-no-floating-actions` requires actions and retrying assertions to be awaited in the supported forms.

Spec rules that keep specs to the generated page objects and to patterns that say what a test does (each can be disabled on a line with a reason):

| Rule | Reports |
|---|---|
| `e2e-no-literal-locators` | A literal, template or const selector in `locator`/`getBy*`, a `getByRole` with a literal name or only a role, a `hasText` filter, any lookup made directly on the page, `$`/`$$`/`$eval`/`waitForSelector`, and DOM queries by selector. |
| `e2e-no-locator-action` | An action made through a driver's raw `.locator` when the driver offers it. |
| `e2e-no-probes` | `isVisible`, `isHidden`, `isChecked`, `isEnabled`, `isDisabled`, `isEditable` outside an `expect.poll` or `toPass` callback. |
| `e2e-no-conditional-logic` | `if`, ternary, loop tests and short-circuit statements that await page state. |
| `e2e-no-swallowed-catch` | `.catch(() => value)` and an empty or value-only `catch`. |
| `e2e-no-sleeps` | `waitForTimeout`, `waitForLoadState('networkidle')` and `setTimeout` waits. |
| `e2e-no-soft-assertions` | `expect.soft`. |
| `e2e-no-url-assertions` | `toHaveURL`; assert where the test is with `toHavePath(app.<page>.pathFor(params))` and the page's `ready` part. |
| `e2e-no-positional-picks` | `.first()`, `.last()` and `.nth()`. |

A disable of any `test-surface/e2e-*` rule must name the rule and include a reason; it silences that report without clearing pending-action state. Nothing counts disables: each is a visible line in a diff, so review is what limits them. Do not add a disable to complete a port.

The [Test Surface CI workflow](../../../.github/workflows/test-surface-ci.yml) checks the tool's lint, types, build and scanner/generator/lint fixtures. The scan check fails on any error.

For tool changes, from `e2e-tests/playwright`:

```sh
npm run check --workspace @mattermost/test-surface
npm run check-types --workspace @mattermost/test-surface
npm run build --workspace @mattermost/test-surface
npm test --workspace @mattermost/test-surface
```

`UPDATE_SNAPSHOTS=1` updates fixture snapshots; inspect those changes. `watch` keeps the program warm, rescans and regenerates after edits. The CLI uses TypeScript source in a checkout and compiled `dist/cli.js` in a distribution without source; build before packaging. `install-hooks` installs opt-in local checks for the selected config; it does not replace CI.

## Plugin projects

Plugin projects provide a config and `plugin.json`. Host version 4 reports describe supported host surfaces; the same scanner/generator handles plugin declarations.

Host configs publish slot templates and the registry methods filling them:

```json
{"pluginSlots":{"channel_header":{"template":"channel_header.menu.plugin:{key}--menuitem","registry":["registerChannelHeaderMenuAction"]}}}
```

A plugin selects the host contract and compatibility reports (these plugin paths are relative to its configured `root`):

```json
{"plugin":{"manifest":"plugin.json","scope":"plugins.calls","host":{"config":"../host/lib/surface/config.json","reports":[{"name":"12.1","report":"../host/lib/surface/webapp.surface.json"}]}}}
```

Only `pluginSlots` is read from the host config; other host options are not applied to the plugin scan. Registry methods belong in the config, and the report publishes slot names/templates for compatibility checks.
