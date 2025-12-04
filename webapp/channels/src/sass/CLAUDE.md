# sass/

Global SCSS styles and theme variables. Component-specific styles should be co-located with components (see `../components/CLAUDE.md`).

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

See STYLE_GUIDE.md for complete styling conventions.

## Global vs Component Styles

- **This directory**: Global styles, theme variables, layout, legacy component styles
- **Component directories**: Component-specific styles co-located with `.tsx` files

New component styles should be co-located, not added here.

## Known Issues (from STYLE_GUIDE.md)

- Over 300 `!important` usages remain (primarily legacy modal overrides)
- Some hard-coded values need migration to theme variables
- Legacy selectors with non-BEM naming exist in older files
