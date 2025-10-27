# Mattermost Themes in Storybook

This Storybook instance supports all 5 official Mattermost themes, allowing you to test components with different color schemes.

## Available Themes

### Light Themes
1. **🔵 Denim** (Default) - The classic Mattermost blue theme
2. **💎 Sapphire** - A vibrant blue theme with cyan accents
3. **⚪ Quartz** - A light gray theme with minimal color

### Dark Themes
4. **🌙 Indigo** - A dark blue theme
5. **⚫ Onyx** - A dark gray/black theme

## How to Switch Themes

1. **Toolbar**: Click the paintbrush icon (🎨) in the Storybook toolbar at the top
2. **Select**: Choose from Denim, Sapphire, Quartz, Indigo, or Onyx
3. **Apply**: The theme will immediately apply to all components

The theme selection persists across story navigation and browser sessions.

## Theme Implementation

### Files
- `theme-utils.ts` - Theme definitions and CSS variable application logic
- `ThemeDecorator.tsx` - React decorator that applies themes
- `preview.tsx` - Storybook configuration with theme toolbar integration

### How It Works

1. **Theme Definitions**: All themes are imported from the official Mattermost Redux constants (`src/packages/mattermost-redux/src/constants/preferences.ts`)

2. **CSS Variables**: When you switch themes, CSS custom properties are updated on `:root`:
   ```css
   --center-channel-bg: #ffffff
   --center-channel-color: #3f4350
   --button-bg: #1c58d9
   --sidebar-bg: #1e325c
   /* ...and many more */
   ```

3. **RGB Values**: For opacity calculations, RGB versions are also set:
   ```css
   --center-channel-bg-rgb: 255, 255, 255
   --button-bg-rgb: 28, 88, 217
   /* Used like: rgba(var(--button-bg-rgb), 0.5) */
   ```

4. **Dynamic Application**: The `ThemeDecorator` listens to toolbar changes and applies the selected theme instantly.

## Testing Components with Themes

### Best Practices

1. **Test All Themes**: Check your component with both light and dark themes
2. **Contrast**: Ensure text is readable in all themes
3. **Interactive States**: Verify hover/active states work across themes
4. **CSS Variables**: Use CSS variables instead of hard-coded colors

### Example: Using Theme Variables in SCSS

```scss
.my-component {
    background-color: var(--center-channel-bg);
    color: var(--center-channel-color);
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.2);
    
    &:hover {
        background-color: rgba(var(--button-bg-rgb), 0.1);
    }
}
```

### Example: Theme-Aware Story

```typescript
import type {Meta, StoryObj} from '@storybook/react';
import MyComponent from './my_component';

const meta: Meta<typeof MyComponent> = {
    title: 'Components/MyComponent',
    component: MyComponent,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component: 'This component adapts to all Mattermost themes. Try switching themes in the toolbar!',
            },
        },
    },
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const Default: Story = {
    args: {
        text: 'Hello World',
    },
};

// Test with different backgrounds
export const OnSidebarBackground: Story = {
    args: {
        text: 'On Sidebar',
    },
    decorators: [
        (Story) => (
            <div style={{
                backgroundColor: 'var(--sidebar-bg)',
                color: 'var(--sidebar-text)',
                padding: '20px',
            }}>
                <Story />
            </div>
        ),
    ],
};
```

## Theme Details

### Denim (Default Light Theme)
- Primary: Blue (#1c58d9)
- Background: White (#ffffff)
- Sidebar: Navy Blue (#1e325c)
- Best for: General light mode testing

### Sapphire (Light Theme)
- Primary: Bright Blue (#1c58d9)
- Background: White (#ffffff)
- Sidebar: Deep Blue (#1543a3)
- Accents: Cyan (#15b7b7)
- Best for: High contrast light mode

### Quartz (Light Gray Theme)
- Primary: Blue (#1c58d9)
- Background: White (#ffffff)
- Sidebar: Light Gray (#f4f4f6)
- Best for: Minimal color, accessibility testing

### Indigo (Dark Blue Theme)
- Primary: Blue (#4a7ce8)
- Background: Dark Blue (#111827)
- Sidebar: Navy (#151e32)
- Best for: Dark mode with color

### Onyx (Dark Gray Theme)
- Primary: Blue (#4a7ce8)
- Background: Very Dark Gray (#191b1f)
- Sidebar: Dark Gray (#202228)
- Best for: True dark mode, OLED screens

## Troubleshooting

### Theme not applying?
- Check that your component uses CSS variables
- Ensure styles are properly scoped under `.app__body`
- Verify SCSS is compiled correctly

### Colors look wrong?
- Check for hard-coded colors overriding theme variables
- Verify opacity calculations use RGB variables
- Test with browser DevTools to inspect CSS variable values

### Performance issues?
- Theme switching is instant (< 16ms)
- If slow, check for expensive re-renders in your component
- Use React DevTools Profiler to identify issues

## Resources

- [Mattermost Theme Documentation](https://docs.mattermost.com/preferences/customize-theme-colors.html)
- [Theme Source Code](../src/packages/mattermost-redux/src/constants/preferences.ts)
- [Theme Utils](../src/packages/mattermost-redux/src/utils/theme_utils.ts)
- [CSS Variables](../src/sass/base/_css_variables.scss)

