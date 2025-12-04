# utils/

Utility functions and helpers for the web app.

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

### Testing

Test utilities are in `../tests/`, not here. See `../tests/CLAUDE.md`.

### Other Notable Utilities

- `emoji_utils.tsx`: Emoji parsing and rendering
- `file_utils.tsx`: File handling utilities
- `url.tsx`: URL manipulation helpers
- `datetime.ts`: Date/time formatting
- `constants.tsx`: Application constants

## Adding New Utilities

1. Create focused, single-purpose utility files
2. Include tests (`.test.ts` alongside the utility)
3. Export from the utility file directly (no barrel exports)
4. Use TypeScript with proper typing

## Reference Implementations

- `keyboard.ts`: Cross-platform keyboard handling
- `a11y_controller.ts`: Accessibility enhancement pattern
- `markdown/renderer.tsx`: Custom rendering with sanitization
