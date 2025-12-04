# CLAUDE: `components/`

## Purpose
- Folder-by-feature organization for every UI surface.
- Each subfolder should include component, SCSS, tests, and local helpers when needed.

## Authoring Pattern
- Use functional components with hooks (`useSelector`, `useDispatch`, custom hooks). See `webapp/STYLE_GUIDE.md → React Component Structure`.
- Keep files small; split heavy logic into hooks (`useX.ts`) or child components.
- Memoize expensive computations with `useMemo`/`useCallback`; wrap render-heavy components with `React.memo`.
- Lazy-load bulky routes using `makeAsyncComponent` and register them via `module_registry.ts`.

## Styling & Theming
- Co-locate SCSS (`MyComponent.scss`) next to the component and import it at the top of the TSX file.
- Use BEM naming: `.MyComponent { ... }`, `.MyComponent__title { ... }`, modifiers via separate classes.
- Pull colors/spacing from `sass/base/_css_variables.scss`; avoid hard-coded values and `!important`.
- Prefer shared mixins for responsiveness; if missing, add to `sass/utils/`.

## Accessibility
- Favor semantic elements (`button`, `input`, `ul`) over divs with ARIA roles.
- When using custom patterns, follow `webapp/STYLE_GUIDE.md → Accessibility` for focus management and keyboard handlers.
- Reuse primitives like `GenericModal`, `Menu`, `WithTooltip`, `A11yController` helpers before creating custom interactions.

## Testing Expectations
- Add/extend RTL tests alongside the component (`*.test.tsx`). See `../tests/react_testing_utils.tsx` for helpers.
- Prefer `userEvent` and accessible queries (`getByRole`) over implementation-specific selectors.
- Avoid snapshots; assert visible behavior instead.

## Useful Examples
- `channel_view/channel_view.tsx` – full-page component structure with co-located SCSS.
- `post_view/post_list_virtualized/post_list_virtualized.tsx` – virtualization + hooks pattern.
- `widgets/menu` components – accessible menu behaviors.



