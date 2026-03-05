# CLAUDE: `sass/`

## Purpose
- Global SCSS for the Channels app: theme tokens, layout primitives, shared mixins.
- Component-specific styles should stay next to their TSX files (see `../components/CLAUDE.md`).

## Directory Structure

```
sass/
├── styles.scss              # Main entry point (imports all modules)
├── base/
│   ├── _css_variables.scss  # Theme CSS variables (colors, elevations, radii)
│   ├── _structure.scss      # Base structural styles
│   └── _typography.scss     # Typography defaults
├── components/              # Global component styles (legacy)
├── layout/                  # Layout styles (headers, sidebars, content)
├── responsive/              # Responsive breakpoint styles
├── routes/                  # Route-specific styles
├── utils/
│   ├── _mixins.scss         # Reusable mixins
│   ├── _functions.scss      # SCSS functions
│   ├── _variables.scss      # SCSS variables (non-CSS)
│   └── _animations.scss     # Animation definitions
└── widgets/                 # Widget styles
```

## Theme Variables
All theme colors are defined in `base/_css_variables.scss`. Always use CSS variables for colors:

```scss
// GOOD
.MyComponent {
    color: var(--center-channel-color);
    background: var(--center-channel-bg);
    border: var(--border-default);
}
```

### Key Variable Categories
- **Colors**: `--center-channel-color`, `--link-color`, `--button-bg`.
- **RGB variants**: `--center-channel-color-rgb` (for rgba transparency).
- **Elevation**: `--elevation-1` through `--elevation-6`.
- **Radius**: `--radius-xs` through `--radius-full`.
- **Borders**: `--border-default`, `--border-light`, `--border-dark`.

## Responsive Patterns
Use mixins from `utils/_mixins.scss` for responsive styles; do not hard-code media queries.

```scss
@import 'utils/mixins';

.MyComponent {
    padding: 16px;
    @include tablet { padding: 12px; }
    @include mobile { padding: 8px; }
}
```

## Styling Rules
- **Naming**: Use PascalCase root class matching component name. Use BEM for children (`.ComponentName__element`) and modifiers (`&.modifier`).
- **Specificity**: Avoid `!important`; favor specificity via nested classes or utility mixins.
- **Units**: Prefer `px` for sizing unless inheriting from existing `rem` usage; keep consistent within a file.

## Cleanup Targets
- Replace hard-coded values with shared tokens.
- Migrate legacy element selectors to component-scoped classes when files are touched.
