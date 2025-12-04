# CLAUDE: `tests/`

## Purpose
- Centralizes shared test utilities, mocks, and sample data for the Channels webapp.
- Provides helpers so component and Redux tests stay concise and user-focused.

## Key Files
- `react_testing_utils.tsx` – exports `renderWithContext`, providers, custom matchers.
- `test_store.tsx` / `helpers/` – mock stores, Intl helpers, matchMedia mocks.
- `setup_jest.ts` – global Jest config for this workspace; extend here instead of per-test hacking.

## Testing Guidelines
- Follow `webapp/STYLE_GUIDE.md → Testing`.
- Use React Testing Library + `userEvent` for UI; avoid Enzyme and DOM snapshots.
- Prefer accessible queries: `getByRole`, `getByText`, etc.
- Keep async tests `await`ing user interactions; wrap manual async flows in `act` only when RTL helpers do not.
- Store-specific tests should assert visible outcomes rather than internal Redux state whenever possible.

## Adding Helpers
- Place reusable mocks under `helpers/` (e.g., `intl-test-helper.tsx`, `match_media.mock.ts`).
- Document custom utilities with inline comments so future updates remain safe.
- If a helper becomes product-agnostic, consider moving it to `platform/components/testUtils.tsx`.

## References
- `performance_mock.test.ts` – example of integration performance testing.
- `helpers/date.ts`, `helpers/admin_console_plugin_index_sample_plugins.ts` for data fixtures.



