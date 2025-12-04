# CLAUDE: `sass/`

Global SCSS styles and theme variables. Component-specific styles should be co-located with components (see `../components/CLAUDE.md`).

## Purpose

- Global SCSS for the Channels app: theme tokens, layout primitives, shared mixins
- Component-specific styles should stay next to their TSX files; update globals only when multiple areas benefit

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
│   ├── _desktop.scss
│   ├── _tablet.scss
│   └── _mobile.scss
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
// GOOD - uses theme variable
.MyComponent {
    color: var(--center-channel-color);
    background: var(--center-channel-bg);
    border: var(--border-default);
}

// BAD - hard-coded color
.MyComponent {
    color: #3d3c40;
}
```

### Key Variable Categories

- **Colors**: `--center-channel-color`, `--link-color`, `--button-bg`, etc.
- **RGB variants**: `--center-channel-color-rgb` (for rgba transparency)
- **Elevation**: `--elevation-1` through `--elevation-6` (box shadows)
- **Radius**: `--radius-xs`, `--radius-s`, `--radius-m`, `--radius-l`, `--radius-xl`, `--radius-full`
- **Borders**: `--border-default`, `--border-light`, `--border-dark`

### Using Transparency

```scss
// Use RGB variants with rgba()
.overlay {
    background: rgba(var(--center-channel-color-rgb), 0.08);
}
```

## Styling Rules

- Follow `webapp/STYLE_GUIDE.md → Styling & Theming`
- Declare colors, radii, spacing as CSS variables in `base/_css_variables.scss` before consumption
- Use BEM and component root classes even in global files to avoid collisions
- Avoid `!important`; favor specificity via nested classes or utility mixins
- Prefer `px` for sizing unless inheriting from existing `rem` usage; keep consistent within a file

## Responsive Mixins

Use mixins from `utils/_mixins.scss` for responsive styles:

```scss
@import 'utils/mixins';

.MyComponent {
    padding: 16px;
    
    @include tablet {
        padding: 12px;
    }
    
    @include mobile {
        padding: 8px;
    }
}
```

## Naming Conventions

- **Component Styles**: Use PascalCase root class matching component name
- **BEM for Children**: `.ComponentName__element`
- **Modifiers**: `&.modifier` inside root class

## Global vs Component Styles

- **This directory**: Global styles, theme variables, layout, legacy component styles
- **Component directories**: Component-specific styles co-located with `.tsx` files

New component styles should be co-located, not added here.

## Cleanup Targets

- Replace hard-coded values with shared tokens
- Migrate legacy element selectors to component-scoped classes when files are touched
- Over 300 `!important` usages remain (primarily legacy modal overrides)
