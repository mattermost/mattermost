# CLAUDE: `components/`

## Purpose
- Folder-by-feature organization for every UI surface.
- Each subfolder should include component, SCSS, tests, and local helpers when needed.

## File Structure

Each component directory should contain:
```
my_component/
├── index.ts            # Re-exports
├── my_component.tsx    # Component implementation
├── my_component.scss   # Co-located styles (imported in component)
└── my_component.test.tsx
```

## Authoring Pattern
- **Functional Components**: Use hooks (`useSelector`, `useDispatch`, `useCallback`, `useMemo`). See `webapp/STYLE_GUIDE.md → React Component Structure`.
- **Small Files**: Split heavy logic into hooks (`useX.ts`) or child components.
- **Memoization**: Use `React.memo` for components with heavy render logic.
- **Code Splitting**: Lazy-load bulky routes using `makeAsyncComponent`:

```typescript
const HeavyComponent = makeAsyncComponent(
    () => import('./heavy_component'),
);
```

## Styling & Theming

- **Co-location**: Put styles in SCSS file next to the component (`import './my_component.scss'`).
- **Root Class**: Match component name in PascalCase (e.g., `.MyComponent`).
- **Child Elements**: Use BEM-style suffix (e.g., `.MyComponent__title`).
- **Theme Variables**: Always use `var(--variable-name)` for colors from `sass/base/_css_variables.scss`.
- **No !important**: Use proper specificity and naming.
- **Transparency**: Use `rgba(var(--color-rgb), 0.5)` for opacity.

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

## Accessibility

- **Semantic HTML**: Use `<button>`, `<input>`, etc. over `<div>` with roles.
- **Keyboard Support**: All interactive elements must be keyboard accessible.
- **Helpers**: Reuse primitives like `GenericModal`, `Menu`, `WithTooltip`, `A11yController` helpers.
- **Focus**: Use `a11y--focused` class for keyboard focus indicators.
- **Images**: Alt text required for information images. Empty `alt=""` for decorative.

## Internationalization

- All UI text must use React Intl.
- Prefer `<FormattedMessage>` over `useIntl()` hook when possible.
- **Rich Text**: Use React Intl's rich text support (e.g., `values={{b: (chunks) => <b>{chunks}</b>}}`) instead of splitting strings.

```typescript
// Preferred
<FormattedMessage id="component.title" defaultMessage="Title" />

// When string is needed for props
const intl = useIntl();
<input placeholder={intl.formatMessage({id: 'input.placeholder', defaultMessage: 'Search...'})} />
```

## Testing Expectations
- Add/extend RTL tests alongside the component (`*.test.tsx`). See `../tests/react_testing_utils.tsx` for helpers.
- Prefer `userEvent` and accessible queries (`getByRole`) over implementation-specific selectors.
- Avoid snapshots; assert visible behavior instead.

## Useful Examples
- `channel_view/channel_view.tsx` – full-page component structure with co-located SCSS.
- `post_view/post_list_virtualized/post_list_virtualized.tsx` – virtualization + hooks pattern.
- `widgets/menu` components – accessible menu behaviors.
