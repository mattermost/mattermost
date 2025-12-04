# CLAUDE: `sass/`

## Purpose
- Global SCSS for the Channels app: theme tokens, layout primitives, shared mixins.
- Component-specific styles should stay next to their TSX files; update globals only when multiple areas benefit.

## Structure
- `base/` – CSS variables, reset, typography.
- `components/`, `layout/`, `routes/`, `widgets/` – legacy global selectors; touch only when refactoring toward BEM.
- `utils/` – mixins (breakpoints, z-index helpers, shadows) for reuse.
- `styles.scss` – root entry imported by the app; ensure new globals are hooked here.

## Styling Rules
- Follow `webapp/STYLE_GUIDE.md → Styling & Theming`.
- Declare colors, radii, spacing as CSS variables in `base/_css_variables.scss` before consumption.
- Use BEM and component root classes even in global files to avoid collisions.
- Avoid `!important`; favor specificity via nested classes or utility mixins.
- Prefer `px` for sizing unless inheriting from existing `rem` usage; keep consistent within a file.

## Responsive Patterns
- Use breakpoint mixins from `responsive/` or `utils/_mixins.scss`; do not hard-code media queries.
- Document any new mixins to encourage reuse.

## Cleanup Targets
- Replace hard-coded values with shared tokens.
- Migrate legacy element selectors to component-scoped classes when files are touched.

## References
- `base/_css_variables.scss` – canonical source for theme tokens.
- `styles.scss` – shows import order (base → utils → layout → components).



