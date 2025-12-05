# CLAUDE: `components/`

## Rules
- **Type**: Functional Components + Hooks ONLY. No Class components.
- **State**: `useSelector`, `useDispatch`. No `connect()`.
- **Logic**: Move heavy logic to custom hooks (`useX.ts`).
- **Performance**: Use `React.memo` for heavy renders. `useMemo`/`useCallback` for props/handlers.
- **Async**: Lazy load heavy routes/components with `makeAsyncComponent`.

## Styling
- **Location**: Co-locate `Component.scss`. Import in TSX.
- **Naming**: `.PascalCaseName` (Root), `.PascalCaseName__element` (Child), `&.modifier` (Modifier).
- **Tokens**: Use CSS variables from `sass/base/_css_variables.scss` (e.g., `var(--button-bg)`).
- **Constraint**: No `!important`. No hardcoded hex colors.

## Accessibility
- **Elements**: Semantic HTML (`button`, `nav`) > ARIA roles.
- **Labels**: Visible labels preferred. Fallback to `aria-label`.
- **Focus**: Ensure visible focus (`a11y--focused`). Trap focus in modals.

## I18n
- **Text**: All UI strings via `React Intl`.
- **Usage**: `<FormattedMessage id="foo" defaultMessage="Bar" />`.

## Testing
- **Tooling**: RTL + `userEvent`.
- **Pattern**: `renderWithContext(<Component />)`.
- **Assert**: Visible behavior (`toBeVisible`), not internal state.
