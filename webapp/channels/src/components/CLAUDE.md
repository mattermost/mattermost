# Components CLAUDE.md

## Component Patterns
- **Functional Components**: Prefer functional components with hooks.
- **Redux Hooks**: Use `useSelector` / `useDispatch`.
- **Memoization**: Use `useCallback` for callbacks and `useMemo` for expensive computations. Wrap heavy components in `React.memo` only if needed.
- **Code Splitting**: Use `makeAsyncComponent` wrapper for lazy loading heavy components/routes.
- **Structure**: Avoid massive components. Break logic into hooks or smaller sub-components.

## Styling & Theming
- **Co-location**: `my_component.scss` should be next to `my_component.tsx`.
- **BEM-style Naming**: 
  - Root class: `PascalCase` (matches component name).
  - Child: `ComponentName__element`.
  - Modifier: `&.modifier` (inside root).
- **Variables**: Use CSS variables from `sass/base/_css_variables.scss` (e.g., `var(--button-bg)`).
- **No !important**: Avoid it. Use specificity or proper class structure.
- **Transparency**: Use `rgba(var(--color-rgb), 0.5)` for opacity.

## Accessibility (A11y)
- **Semantic HTML**: `<button>`, `<input>`, `<nav>` > `<div>`.
- **Labels**: Use visible labels where possible. Otherwise `aria-label` or `aria-labelledby`.
- **Keyboard**: Ensure all interactive elements are reachable via Tab and usable via Enter/Space.
- **Focus**: 
  - Visible focus required (`a11y--focused` or `:focus-visible`).
  - Focus management for modals (trap focus, return on close).
- **A11yController**: Use `a11y__region`, `a11y__section`, `a11y__modal` for enhanced navigation.
- **Images**: Alt text required for information images. Empty `alt=""` for decorative.

## Internationalization (I18n)
- **Translatable**: All UI text must be translatable.
- **FormattedMessage**: Prefer `<FormattedMessage id="id" defaultMessage="Default" />`.
- **Rich Text**: Use React Intl's rich text support (e.g., `values={{b: (chunks) => <b>{chunks}</b>}}`) instead of splitting strings.

## Testing (RTL)
- **Framework**: React Testing Library (RTL).
- **Context**: Use `renderWithContext` from `utils/react_testing_utils`.
- **User-Centric**: Test interactions (`userEvent.click`) and visible output (`screen.getByText`), not internal state.
- **Selectors**: `getByRole` > `getByText` > `getByLabelText` > `getByTestId`.
- **No Snapshots**: Use explicit assertions: `expect(element).toBeVisible()`.
- **Async**: Always `await` user events.

## Dependencies
- **UI Library**: `@mattermost/components` (GenericModal, etc.).
- **Icons**: `@mattermost/compass-icons`.
- **Tooltips**: `WithTooltip` or Floating UI.



