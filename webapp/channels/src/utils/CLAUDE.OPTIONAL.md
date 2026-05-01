# CLAUDE: `utils/`

## Purpose
- Shared helper functions, hooks, telemetry utilities, and adapters used across the Channels app.
- Keep business rules out of components/actions by moving reusable logic here.

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
- `a11y_controller.ts`: Enhanced keyboard navigation controller.
- `a11y_utils.ts`: Accessibility helper functions.

### Keyboard Handling
- `keyboard.ts`: Cross-platform keyboard handling.
- Use `isKeyPressed` and `cmdOrCtrlPressed`.

### Text Processing
- `text_formatting.tsx`: Text formatting and sanitization.
- `markdown/`: `renderer.tsx` (custom renderer), `apply_markdown.ts`.

## Guidelines
- **Strong Typing**: Prefer concrete interfaces over `any`. Reference `channels/src/types` or `@mattermost/types`.
- **Purity**: Keep utilities pure when possible. Document side-effects.
- **Accessibility**: Helpers should follow `webapp/STYLE_GUIDE.md → Accessibility`.
- **Organization**: Prefix folders by domain. Avoid sprawling “misc” files.

## Adding New Utilities
1. Create focused, single-purpose utility files.
2. Include tests (`.test.ts`) alongside the utility.
3. Export from the utility file directly.
