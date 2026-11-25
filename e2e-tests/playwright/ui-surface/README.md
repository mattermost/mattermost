# @mattermost/ui-surface

A lean, additive tool that turns the webapp's `data-surface` / `data-testid` declarations into a typed Playwright SDK
and guards them with a fast scanner and ESLint rules. It is additive (one attribute, no Jest/Cypress edits required), it
scans the whole webapp in a few seconds, and it commits no generated report.

## Adding an id (product engineers)

Put a `data-surface` on the element, using the grammar `scope.name[:key][--role]`:

```tsx
<div data-surface="channel_settings">
    <button data-surface="channel_settings.save--button">Save</button>
    <input type="checkbox" data-surface="channel_settings.enabled--checkbox" />
    {rows.map((r) => (
        <li key={r.id} data-surface={`channel_settings.row:${r.id}--listitem`} />
    ))}
</div>
```

Rules the scanner enforces (run `ui-surface explain <rule>` for any of them):

- **grammar** — lowercase path words, dot-separated, an optional `:key`, and a known `--role`.
- **role-fit** — a state/input role (`--checkbox`, `--switch`, `--textbox`, ...) must be on an element that really has
  those semantics. Custom components are vouched for in [`role-map.json`](./role-map.json).
- **key-origin** — a `:key` must be an entity id (`r.id`, `*Id`), not the map index, display text, or a composite. Local
  aliases (`const id = r.id`) are followed.
- **duplicates / drift** — ids are unique; an element with both `data-testid` and `data-surface` must agree (see
  [`testid-surface-map.json`](./testid-surface-map.json)).
- **legacy-testid ratchet** — a new free-form or dynamic `data-testid` fails unless it is grammar or paired with a
  `data-surface`. The baseline ([`testid-baseline.json`](./testid-baseline.json)) may only shrink.

## Using an id in a spec (SDET)

```ts
import {createSurface, expect, test} from '@mattermost/playwright-lib';

test('saves', async ({page}) => {
    const s = createSurface(page);
    await s.channel_settings().save.click();
    await expect(s.channel_settings().container).toBeVisible();
});
```

Keyed parts take a branded key type when the key is a known entity (e.g. `PluginId`), so a wrong key fails to compile.
Spec ESLint rules (observe-actions, no-floating-actions, no-url-assertions, ...) keep specs flake-free; disable one only
with `// eslint-disable-next-line ui-surface/<rule> -- reason`.

## Retiring a legacy id (renamer)

```sh
ui-surface migrate-testid                 # dry-run: how many Jest/Cypress files auto-migrate vs need hand edits
ui-surface migrate-testid --apply --only <path>   # rewrite component + tests in one area
ui-surface drift --update                 # refresh the testid->surface pairings
ui-surface baseline --update              # shrink the ratchet (never grows without --allow-growth)
```

## Plugin authors

Host UI slots and the registry methods that fill them are in [`plugin-slots.json`](./plugin-slots.json); the 3-layer
host↔plugin contract is emitted by `ui-surface host-contract` and diffed in CI against
[`host-contract.baseline.json`](./host-contract.baseline.json) to block breaking removals.

## Commands

| Command                                                    | Purpose                                                                                              |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `ui-surface check [--incremental] [--changed-since <ref>]` | Scan the webapp: grammar, role-fit, key-origin, duplicates, drift, stale references, testid ratchet. |
| `ui-surface scan` / `generate`                             | Print scan stats / regenerate the typed SDK (gitignored).                                            |
| `ui-surface baseline [--update [--allow-growth]]`          | Inspect or update the legacy-testid ratchet baseline.                                                |
| `ui-surface drift [--update]`                              | Inspect or update the testid↔surface pairings.                                                       |
| `ui-surface migrate-testid [--apply] [--only <path>]`      | Codemod retiring legacy testids (dry-run by default).                                                |
| `ui-surface migrate-spec [--out <file>]`                   | Dry-run coverage: which spec selectors map to `createSurface()` parts.                               |
| `ui-surface host-contract [diff <a> <b>]`                  | Emit or diff the host↔plugin contract.                                                               |
| `ui-surface explain <rule>`                                | Explain a rule and its fix.                                                                          |

Fixes: ESLint autofixes trivial violations (e.g. `expect.soft` → `expect`); `migrate-testid` and `baseline --update`
handle the rest. The incremental cache lives in `e2e-tests/playwright/.ui-surface-cache` (gitignored, restorable by
`actions/cache`).
