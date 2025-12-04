# CLAUDE: `utils/`

Utility functions and helpers for the web app.

## Purpose

- Shared helper functions, hooks, telemetry utilities, and adapters used across the Channels app
- Keep business rules out of components/actions by moving reusable logic here

## Directory Structure

```
utils/
├── *.ts                    # General utilities
├── markdown/               # Markdown parsing and rendering utilities
├── performance_telemetry/  # Performance monitoring
├── plugins/                # Plugin-related utilities
├── popouts/                # Window popout utilities
└── use_websocket/          # WebSocket React hooks
```

## Key Utilities

### Accessibility

- `a11y_controller.ts`: Enhanced keyboard navigation controller
- `a11y_controller_instance.ts`: Singleton instance
- `a11y_utils.ts`: Accessibility helper functions

### Keyboard Handling

- `keyboard.ts`: Keyboard event utilities
  - Use `isKeyPressed(event, Constants.KeyCodes.KEY_NAME)` for key detection (supports different layouts)
  - Use `cmdOrCtrlPressed(event)` for cross-platform shortcuts

### Navigation

- `browser_history.tsx`: History management with `getHistory()`
- Note: Prefer `useHistory()` hook from React Router in new code

### Text Processing

- `text_formatting.tsx`: Text formatting and sanitization
- `markdown/`: Markdown parsing utilities
  - `renderer.tsx`: Custom markdown renderer
  - `apply_markdown.ts`: Apply markdown to text
  - `remove_markdown.ts`: Strip markdown from text

### Other Notable Utilities

- `emoji_utils.tsx`: Emoji parsing and rendering
- `file_utils.tsx`: File handling utilities
- `url.tsx`: URL manipulation helpers
- `datetime.ts`: Date/time formatting
- `constants.tsx`: Application constants
- `post_utils.ts`: Post processing helpers

## Organization Guidelines

- Prefix folders by domain (`markdown/`, `popouts/`, `performance_telemetry/`, `a11y_*.ts`)
- Each utility should ship with unit tests (`*.test.ts`) demonstrating usage
- Avoid sprawling "misc" files; create descriptive filenames or subfolders

## Code Guidelines

- Strong typing required—prefer concrete interfaces over `any`. Reference `channels/src/types` or `@mattermost/types`
- Keep utilities pure when possible. Side-effectful helpers (e.g., telemetry reporters) must document assumptions
- Accessibility helpers should follow `webapp/STYLE_GUIDE.md → Accessibility`
- When a helper is generic and product-agnostic, consider relocating to `platform/components` or `platform/types`

## Common Patterns

- Markdown processing (`markdown/*`) – ensure tests cover regressions and mention sanitization expectations
- Telemetry (`performance_telemetry/*`) – isolate browser APIs behind guards for SSR/tests
- Browser utilities (`desktop_api.ts`, `use_browser_popout.ts`) – handle feature detection gracefully

## Adding New Utilities

1. Create focused, single-purpose utility files
2. Include tests (`.test.ts` alongside the utility)
3. Export from the utility file directly (no barrel exports)
4. Use TypeScript with proper typing

Test utilities are in `../tests/`, not here. See `../tests/CLAUDE.md`.

## Reference Implementations

- `keyboard.ts`: Cross-platform keyboard handling
- `a11y_controller.ts`: Accessibility enhancement pattern
- `markdown/renderer.tsx`: Custom rendering with sanitization
- `performance_telemetry/reporter.ts`: Telemetry implementation
