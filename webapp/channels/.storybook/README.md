# Mattermost Webapp Storybook Configuration

This directory contains the Storybook configuration for the Mattermost webapp, including components from the channels, platform/components, and platform/design-system packages.

## Current Implementation Status

✅ **Implemented:**
- Webpack 5 builder with full SCSS support
- IntlProvider and React Router decorators
- Monorepo-compatible configuration with `getAbsolutePath`
- Stories co-located with components (best practice)
- TypeScript exclusion of story files from production builds
- Full Mattermost SCSS styles loaded via `sass-loader`

📋 **In Progress:**
- Expanding story coverage for additional components
- Documenting component design patterns

## Configuration Files

### `main.ts`
Main Storybook configuration that defines:
- **Story file patterns** across multiple packages:
  - `webapp/channels/src/**/*.stories.tsx` - Channel components
  - `webapp/platform/components/src/**/*.stories.tsx` - Platform components  
  - `webapp/platform/design-system/src/**/*.stories.tsx` - Design system primitives
- **Framework**: `@storybook/react-webpack5` with Webpack 5 builder
- **Webpack configuration**:
  - Mirrors main webapp aliases (mattermost-redux, components, utils, etc.)
  - Single React instance resolution for monorepo compatibility
  - SCSS loader with proper `loadPaths` for Mattermost styles
  - CSS and SCSS processing with `style-loader` and `css-loader`
- **Addons**: essentials, interactions, a11y (using `getAbsolutePath` for monorepo support)
- **Babel configuration** for TypeScript support

### `preview.tsx`
Global decorators and parameters:
- **IntlProvider** for i18n support (English locale with translations)
- **React Router** with memory history for navigation context
- **Global styles**:
  - Main Mattermost SCSS (`src/sass/styles.scss`)
  - Custom Storybook CSS variables (`storybook-styles.css`)
- **Layout**: `.app__body` wrapper for proper CSS scoping

### `storybook-styles.css`
Custom CSS file providing:
- Essential CSS variables (colors, borders, typography, elevation)
- Component-specific overrides where needed
- Open Sans font loading

## Running Storybook

```bash
# From the monorepo root
npm --prefix webapp/channels run storybook

# Or from webapp/channels directory
npm run storybook

# Build static Storybook (for deployment)
npm run build-storybook
```

The Storybook will be available at **`http://localhost:6007`**

## Writing Stories

### Best Practice: Co-locate Stories with Components

**✅ DO:** Place story files next to the component they document

```
src/components/widgets/tag/
├── tag.tsx
├── tag.stories.tsx    ← Story file here
├── bot_tag.tsx
└── guest_tag.tsx
```

**❌ DON'T:** Create separate `stories/` directories

~~stories/widgets/Tag.stories.tsx~~ ← Not recommended

### Story File Naming Convention

- Use snake_case to match component files: `button.stories.tsx`
- Stories are automatically discovered by the pattern `**/*.stories.tsx`

### Example Story Structure

```typescript
// src/components/widgets/tag/tag.stories.tsx
import React from 'react';
import type {Meta, StoryObj} from '@storybook/react';

import Tag from './tag';

const meta: Meta<typeof Tag> = {
    title: 'Widgets/Tag',
    component: Tag,
    tags: ['autodocs'],
    argTypes: {
        variant: {
            control: 'select',
            options: ['general', 'info', 'success', 'warning', 'danger'],
        },
    },
};

export default meta;
type Story = StoryObj<typeof Tag>;

export const Default: Story = {
    args: {
        text: 'Tag',
        variant: 'general',
    },
};
```

## Story Locations

Stories are automatically loaded from:

1. **`webapp/channels/src/**/*.stories.tsx`** - Channel webapp components
2. **`webapp/platform/components/src/**/*.stories.tsx`** - Platform shared components
3. **`webapp/platform/design-system/src/**/*.stories.tsx`** - Design system primitives

## Aliases and Imports

The Webpack configuration mirrors main webapp aliases:

```typescript
// Available import paths in stories:
import {something} from 'mattermost-redux/...';
import Component from 'components/...';
import {utility} from 'utils/...';
import {action} from 'actions/...';
// ... and more
```

This allows stories to import using the same paths as the main application.

## TypeScript Configuration

Story files are **excluded from production builds** via `tsconfig.json`:

```json
{
  "exclude": [
    "./src/**/*.test.tsx",
    "./src/**/*.stories.tsx",
    "node_modules",
    "dist"
  ]
}
```

This ensures:
- ✅ Stories are type-checked during development
- ✅ Stories are linted with ESLint
- ❌ Stories are NOT compiled to production bundles
- ❌ Stories are NOT included in npm packages

## Addons Enabled

- **@storybook/addon-essentials** - Controls, Actions, Viewport, Backgrounds, Docs
- **@storybook/addon-interactions** - Interactive behavior testing
- **@storybook/addon-a11y** - Accessibility testing and validation

## Styling

### How Styles Work

1. **Main SCSS** - `preview.tsx` imports `../src/sass/styles.scss`
   - Loads all Mattermost component styles
   - Includes Bootstrap, Font Awesome, and custom styles
   
2. **CSS Variables** - `storybook-styles.css` provides:
   - Essential CSS variables (e.g., `--semantic-color-info`, `--radius-xs`)
   - Component-specific overrides
   - Typography and elevation tokens

3. **Component Styles** - Automatically loaded via imports:
   - SCSS modules are processed by `sass-loader`
   - `styled-components` use CSS variables

### SCSS Configuration

The `sass-loader` is configured with proper `loadPaths`:
```typescript
sassOptions: {
  loadPaths: [
    path.resolve(__dirname, '../src/sass'),
    path.resolve(__dirname, '../src'),
    path.resolve(__dirname, '../../node_modules'),
  ],
}
```

This allows SCSS `@use` statements to resolve correctly.

## CI/CD Integration

Story files are properly integrated into the development workflow:

- ✅ **Linting** - ESLint checks all `.stories.tsx` files
- ✅ **Type checking** - TypeScript validates stories (but doesn't compile them)
- ✅ **CI Pipeline** - GitHub Actions runs checks on stories
- ✅ **Production builds** - Stories are excluded from webpack bundles

## Monorepo Best Practices

This Storybook configuration follows best practices for monorepos:

1. **`getAbsolutePath` helper** - Ensures proper package resolution:
   ```typescript
   const getAbsolutePath = (packageName: string) =>
     path.dirname(require.resolve(path.join(packageName, 'package.json')))
   ```

2. **Single React instance** - Webpack aliases prevent "multiple React" errors:
   ```typescript
   react: path.resolve(__dirname, '../../node_modules/react'),
   'react-dom': path.resolve(__dirname, '../../node_modules/react-dom'),
   ```

3. **Workspace-aware** - Loads stories from multiple npm workspace packages

## Troubleshooting

### Stories not appearing

1. Verify the story file matches the pattern: `*.stories.tsx`
2. Check that the story is in one of the configured locations
3. Restart Storybook: `lsof -ti:6007 | xargs kill -9 && npm run storybook`

### SCSS compilation errors

If you see SASS-related errors:
1. Ensure `sass` is installed: `npm list sass`
2. Check that your SCSS `@use` paths are correct
3. Verify the `loadPaths` in `main.ts` include your SCSS directory

### Component styling issues

If components don't look right:
1. Check that `styles.scss` is imported in `preview.tsx`
2. Verify CSS variables are defined in `storybook-styles.css`
3. Ensure the component has the `.app__body` wrapper in its story

### "Invalid hook call" errors

This indicates multiple React instances. Verify:
1. React aliases are configured in `main.ts`
2. You're not accidentally bundling React multiple times
3. All packages use the same React version

### Module resolution issues

For import errors:
1. Check that aliases are configured in `main.ts`
2. Ensure the package is in the workspace (`webapp/package.json` workspaces)
3. Run `npm install` at the workspace root

## Resources

- [Storybook Documentation](https://storybook.js.org/docs/react/)
- [Storybook Monorepo Guide](https://storybook.js.org/docs/faq#how-do-i-fix-module-resolution-in-special-environments)
- [Webpack Configuration](https://storybook.js.org/docs/react/builders/webpack)
- [Writing Stories](https://storybook.js.org/docs/react/writing-stories)
