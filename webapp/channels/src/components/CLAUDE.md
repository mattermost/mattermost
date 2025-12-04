# CLAUDE: `components/`

React components organized by feature. This directory contains 300+ component subdirectories.

## Purpose

- Folder-by-feature organization for every UI surface
- Each subfolder should include component, SCSS, tests, and local helpers when needed

## Component Patterns

### Functional Components
- Write new components as functional components with hooks
- Use `useSelector`/`useDispatch` instead of `connect` HOC
- Use `useCallback` for callbacks passed to children
- Use `useMemo` for expensive computations or objects/arrays passed as props
- Use `React.memo` for components with heavy render logic (skip for cheap renders)

### Code Splitting

Use `makeAsyncComponent` wrapper for lazy loading heavy components:

```typescript
const HeavyComponent = makeAsyncComponent(
    () => import('./heavy_component'),
);
```

Register async chunks via `module_registry.ts`.

## File Structure

Each component directory should contain:

```
my_component/
├── index.ts            # Re-exports
├── my_component.tsx    # Component implementation
├── my_component.scss   # Co-located styles (imported in component)
└── my_component.test.tsx
```

## Styling Conventions

- **Co-location**: Put styles in SCSS file next to the component
- **Root Class**: Match component name in PascalCase (e.g., `.MyComponent`)
- **Child Elements**: Use BEM-style suffix (e.g., `.MyComponent__title`)
- **Modifiers**: Add as separate class (e.g., `&.compact` inside `.MyComponent`)
- **Theme Variables**: Always use `var(--variable-name)` for colors from `sass/base/_css_variables.scss`
- **Avoid !important**: Use proper specificity and naming

```scss
// my_component.scss
.MyComponent {
    color: var(--center-channel-color);
    
    &__title {
        font-weight: 600;
    }
    
    &.compact {
        padding: 4px;
    }
}
```

## Accessibility Requirements

- **Semantic HTML**: Use `<button>`, `<input>`, etc. over `<div>` with roles
- **Accessible Names**: Use visible labels, `aria-labelledby`, or `aria-label` (prefer visible)
- **Keyboard Support**: All interactive elements must be keyboard accessible
- **A11yController Classes**:
  - `a11y__region` + `data-a11y-sort-order`: F6 navigation between regions
  - `a11y__section`: Arrow key navigation in lists
  - `a11y__modal` / `a11y__popup`: Disable global nav in modals
- **Focus**: Use `a11y--focused` class for keyboard focus indicators

See STYLE_GUIDE.md for detailed accessibility guidelines.

## Internationalization

- All UI text must use React Intl
- Prefer `<FormattedMessage>` over `useIntl()` hook when possible
- Use React Intl's rich text formatting for mixed formatting (not Markdown)
- Don't use `localizeMessage` (deprecated)

```typescript
// Preferred
<FormattedMessage id="component.title" defaultMessage="Title" />

// When string is needed for props
const intl = useIntl();
<input placeholder={intl.formatMessage({id: 'input.placeholder', defaultMessage: 'Search...'})} />
```

## Reusable Components to Prefer

- `GenericModal` from `@mattermost/components` (not React Bootstrap Modal)
- `WithTooltip` for tooltips (uses Floating UI)
- `Menu` components in `./menu/` for menus and dropdowns
- Icons from `@mattermost/compass-icons`

## Testing Expectations

- Add/extend RTL tests alongside the component (`*.test.tsx`). See `../tests/react_testing_utils.tsx` for helpers
- Prefer `userEvent` and accessible queries (`getByRole`) over implementation-specific selectors
- Avoid snapshots; assert visible behavior instead

## Reference Implementations

- `channel_view/channel_view.tsx`: Full-page component structure with co-located SCSS
- `post_view/post_list_virtualized/post_list_virtualized.tsx`: Virtualization + hooks pattern
- `with_tooltip/`: Floating UI tooltip wrapper pattern
- `menu/`: Accessible menu component with keyboard navigation
- `confirm_modal.tsx`: Modal dialog pattern
